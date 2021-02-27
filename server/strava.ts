import '@strava-heatmapper/shared/config/dotenv';

import { mkdir, readFile, writeFile } from 'fs/promises';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import lockfile from 'proper-lockfile';
import { v4 as uuid, validate as validateUUID } from 'uuid';

import NeedsLogin from './needs-login';

const { STRAVA_CLIENT_ID: stravaClientId, STRAVA_CLIENT_SECRET: stravaClientSecret } = process.env;

export type SummaryActivity = {
  id: number;
  name: string;
  start_date_local: string;
  map: { summary_polyline: string };
  type: string;
};

export type SummaryRoute = {
  id_str: string;
  name: string;
  created_at: string;
  map: { summary_polyline: string };
  type: string;
  sub_type: number;
};

interface OAuthCallbackResponse {
  code: string;
  state: string;
  scope: string;
}

const callbacks = new Map<string, (registration: OAuthCallbackResponse) => void>();

const CALLBACK_TIMEOUT = 15 * 60 * 1000; // 15 min

const addCallback = (name: string): Promise<OAuthCallbackResponse> =>
  new Promise((resolve, reject) => {
    callbacks.set(name, (data) => {
      callbacks.delete(name);
      resolve(data);
    });
    setTimeout(() => {
      callbacks.delete(name);
      reject();
    }, CALLBACK_TIMEOUT);
  });

export function validTokenCallback(data: Partial<OAuthCallbackResponse>): data is OAuthCallbackResponse {
  const validString = (val: unknown): val is string => !!val && typeof val === 'string';
  return validString(data.code) && validString(data.state) && validString(data.scope);
}

export function tokenExchange(data: OAuthCallbackResponse): boolean {
  const resolver = callbacks.get(data.state);
  if (!resolver) return false;
  resolver(data);
  return true;
}

const SESSIONS_DIR = 'sessions';
const sessionCacheFile = (token: string) => `${SESSIONS_DIR}/${token}.json`;

interface Cache {
  stravaRefreshToken?: string;
  stravaAthlete?: number;
  stravaAccessToken?: string;
  stravaExpiry?: number;
}

/**
 * Lock a file and update its contents.
 *
 * The second overload allows a more specific type to be inferred for the new value of the file.
 */
async function updateFile<T>(file: string, initial: T, transformer: (contents: T) => undefined | void): Promise<T>;

async function updateFile<T, U extends T = T>(file: string, initial: T, transformer: (contents: T) => U): Promise<U>;

async function updateFile<T>(file: string, initial: T, transformer: (contents: T) => T | void): Promise<T> {
  let release: () => Promise<void>;
  try {
    await mkdir(SESSIONS_DIR, { recursive: true });
    release = await lockfile.lock(file, { retries: 4, realpath: false });
  } catch (e) {
    console.error('Cannot lock', file, e);
    throw e;
  }
  try {
    let fileContents: T;
    try {
      fileContents = JSON.parse(await readFile(file, 'utf-8'));
    } catch (e) {
      if (initial === undefined) return initial;
      fileContents = initial;
    }
    const newContents = transformer(fileContents) || fileContents;
    await writeFile(file, JSON.stringify(newContents));
    return newContents;
  } finally {
    await release();
  }
}

export class Strava {
  private readonly token: string;

  constructor(
    private readonly domain: string,
    tokenCookie: string | undefined,
    private readonly requestLogin: (token: string, url: string) => Promise<void>,
  ) {
    this.token = tokenCookie && validateUUID(tokenCookie) ? tokenCookie : uuid();
    this.requestLogin = requestLogin;
  }

  private async loadCache(): Promise<Cache> {
    try {
      const jsonStr = await readFile(sessionCacheFile(this.token), 'utf-8');
      const cache: Cache = JSON.parse(jsonStr);
      if (!cache.stravaAthlete) throw new NeedsLogin();
      const currentEpochSeconds = Date.now() / 1e3;
      if (cache.stravaExpiry && cache.stravaExpiry < currentEpochSeconds) {
        delete cache.stravaAccessToken;
      }
      return cache;
    } catch (error) {
      return {};
    }
  }

  /**
   * Updates cached strava authentication tokens if necessary
   */
  private async getStravaToken(params?: { code: string | string[]; grant_type: string }): Promise<string> {
    let calculatedParams: { refresh_token: string } | { code: string | string[]; grant_type: string };
    if (params) calculatedParams = params;
    else {
      const cache = await this.loadCache();
      if (cache.stravaAccessToken) return cache.stravaAccessToken;
      if (!cache.stravaRefreshToken) throw new NeedsLogin();

      calculatedParams = {
        refresh_token: cache.stravaRefreshToken,
      };
    }

    // get new tokens
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'post',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        ...calculatedParams,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status >= 400 && params) {
      console.error('/token:', res.status, 'body:', await res.json());
      process.exit(1);
    }
    const data: {
      expires_at: number;
      refresh_token: string;
      access_token: string;
      athlete?: { id: number };
    } = await res.json();

    const stravaAthlete = data.athlete?.id;

    const cache = await updateFile(sessionCacheFile(this.token), { stravaAthlete }, (oldCache: Cache) => ({
      ...oldCache,
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaExpiry: data.expires_at,
    }));

    console.debug(`ref: ${data.refresh_token?.substring(0, 6)}`);

    return cache.stravaAccessToken;
  }

  private async rawStravaAPI(endpoint: string, query: Record<string, string | number | undefined> = {}) {
    const API_BASE = 'https://www.strava.com/api/v3';
    const queryString = (Object.entries(query).filter(([, value]) => value) as [string, string | number][])
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const API = `${API_BASE}${endpoint}?${queryString}`;

    const data = await fetch(API, {
      headers: { Authorization: `Bearer ${await this.getStravaToken()}` },
    });
    return data;
  }

  async getAthlete(): Promise<number> {
    const athlete = (await this.loadCache()).stravaAthlete;
    if (athlete !== undefined) return athlete;
    await this.getAccessTokenFromBrowser();
    return await this.getAthlete();
  }

  private async getAccessTokenFromBrowser(): Promise<void> {
    const athleteInfoPromise = addCallback(this.token);

    await this.requestLogin(
      this.token,
      `http://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=${this.domain}/api/token&state=${this.token}&approval_prompt=auto&scope=read_all,activity:read_all`,
    );

    await athleteInfoPromise.then(
      (oauthResponse) => {
        return this.getStravaToken({
          code: oauthResponse.code,
          grant_type: 'authorization_code',
        });
      },
      () => this.getAccessTokenFromBrowser(),
    );
  }

  /**
   * Replace any word in curly braces in the URL with the appropriate value.
   * @param endpoint The URL to interpolate in.
   */
  private async interpolateEndpoint(endpoint: string) {
    const regex = /\{\s*(\w+)\s*\}/g;
    if (!regex.test(endpoint)) return endpoint;
    const cache = await this.loadCache();
    return endpoint.replace(regex, (_, key) => {
      const replacements = {
        athlete: cache.stravaAthlete,
      };
      if (key in replacements) return replacements[key];
      throw new Error(`Unknown interpolation ${JSON.stringify(key)}`);
    });
  }

  private async retryStravaAPI(
    endpoint: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<Response> {
    await this.getAccessTokenFromBrowser();
    return await this.rawStravaAPI(await this.interpolateEndpoint(endpoint), query);
  }

  private async stravaAPI<T>(endpoint: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    let data: Response;
    try {
      data = await this.rawStravaAPI(await this.interpolateEndpoint(endpoint), query);
      if (data.status === 401) {
        data = await this.retryStravaAPI(endpoint, query);
      }
    } catch (e) {
      if (e instanceof NeedsLogin) {
        data = await this.retryStravaAPI(endpoint, query);
      } else throw e;
    }
    const json = await data.json();

    return json;
  }

  private async getActivitiesPage(i: number, start?: number, end?: number): Promise<SummaryActivity[]> {
    return this.stravaAPI('/athlete/activities', {
      per_page: 200,
      page: i,
      before: end === undefined ? undefined : Math.floor(end),
      after: start === undefined ? undefined : Math.floor(start),
    });
  }

  /**
   * Fetches your data from the Strava API
   */
  async *getStravaActivitiesPages(start?: number, end?: number): AsyncGenerator<SummaryActivity[], void, undefined> {
    let i = 1;
    while (true) {
      const page = await this.getActivitiesPage(i, start, end);
      if (!page.length) break;
      yield page;
      i += 1;
    }
  }

  /**
   * Fetches your data from the Strava API
   */
  async *getStravaActivities(start?: number, end?: number): AsyncGenerator<unknown, void, undefined> {
    for await (const page of this.getStravaActivitiesPages(start, end)) {
      yield* page;
    }
  }

  private async getRoutesPage(i: number): Promise<SummaryRoute[]> {
    return this.stravaAPI('/athletes/{athlete}/routes', {
      per_page: 200,
      page: i,
    });
  }

  /**
   * Fetches your data from the Strava API
   */
  public async *getStravaRoutesPages(): AsyncGenerator<SummaryRoute[], void, undefined> {
    let i = 1;
    while (true) {
      const page = await this.getRoutesPage(i);
      console.log('route page', i, 'has length', page.length);
      if (!page.length) break;
      yield page;
      i += 1;
    }
  }

  /**
   * Fetches your data from the Strava API
   */
  async *getStravaRoutes(): AsyncGenerator<unknown, void, undefined> {
    for await (const page of this.getStravaRoutesPages()) {
      yield* page;
    }
  }

  async getActivity(id: number | string): Promise<SummaryActivity> {
    return await this.stravaAPI(`/activities/${id}`);
  }
}
