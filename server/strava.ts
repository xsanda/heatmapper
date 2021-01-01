#!/usr/bin/env node

import { createServer } from 'http';
import fetch, { Response } from 'node-fetch';
import { readFileSync, writeFileSync, realpathSync } from 'fs';
import { parse } from 'url';
import fp from 'find-free-port';
import dotenv from 'dotenv';

dotenv.config();

const { STRAVA_CLIENT_ID: stravaClientId, STRAVA_CLIENT_SECRET: stravaClientSecret } = process.env;

const AUTH_CACHE_FILE = 'strava-auth.json';

type Cache = {
  stravaRefreshToken: string;
  stravaAthlete: number;
  stravaAccessToken: string;
};

let cache: Cache | null = null;

function getCache(): Cache | null {
  if (cache) return cache;
  try {
    const jsonStr = readFileSync(AUTH_CACHE_FILE, 'utf-8');
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

/**
 * Updates cached strava authentication tokens if necessary
 */
async function getStravaToken(tokens?: {
  code: string | string[];
  grant_type: string;
}): Promise<string> {
  if (!tokens && cache?.stravaAccessToken) return cache.stravaAccessToken;

  // read cache from disk
  cache = getCache();

  // get new tokens
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'post',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      ...(tokens || { refresh_token: cache.stravaRefreshToken }),
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status >= 400 && tokens) {
    console.error("/token:", res.status, "body:", await res.json());
    process.exit(1);
  }
  const data = await res.json();
  if (data.athlete) cache.stravaAthlete = data.athlete.id;
  cache.stravaAccessToken = data.access_token;
  cache.stravaRefreshToken = data.refresh_token;
  console.debug(`ref: ${cache.stravaRefreshToken?.substring(0, 6)}`);

  // save to disk
  writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cache));

  setTimeout(() => {
    delete cache.stravaAccessToken;
    getStravaToken();
  }, 1000 * 60 * 60);

  return cache.stravaAccessToken;
}

async function rawStravaAPI(endpoint: string, query: Record<string, any> = {}) {
  const API_BASE = 'https://www.strava.com/api/v3';
  const queryString = Object.entries(query)
    .filter(([, value]) => value)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const API = `${API_BASE}${endpoint}?${queryString}`;

  const data = await fetch(API, {
    headers: { Authorization: `Bearer ${await getStravaToken()}` },
  });
  return data;
}

async function getAccessTokenFromBrowser(): Promise<void> {
  const [port] = await fp(10000);
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const requestUrl = parse(request.url, true);
      if (requestUrl.pathname !== '/strava-token') {
        console.debug(`Ignoring request to ${requestUrl.pathname}`);
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('Complete, you may now close this window');
      response.end();
      server.close();
      await getStravaToken({
        code: requestUrl.query.code,
        grant_type: 'authorization_code',
      });
      resolve();
    });
    server.listen({ port });
    console.error(
      'Unauthorised, please visit',
      `http://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=http://localhost:${port}/strava-token&approval_prompt=auto&scope=read_all,profile:read_all,activity:read_all`,
    );
  });
}

class NeedsLogin extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'NeedsLogin';
    // setPrototypeOf explanation:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, NeedsLogin.prototype);
  }
}

function interpolateEndpoint(endpoint: string) {
  return endpoint.replace(/\s*\{(\w+)\s*\}/g, (_, key) => {
    const replacements = {
      athlete: () =>
        getCache()?.stravaAthlete ||
        (() => {
          console.log(cache);
          throw new NeedsLogin();
        })(),
    };
    if (replacements.hasOwnProperty(key)) return replacements[key]();
    else throw new Error(`Unknown interpolation ${JSON.stringify(key)}`);
  });
}

async function stravaAPI<T>(endpoint: string, query: Record<string, any> = {}): Promise<T> {
  let data: Response;
  let needsLogin = false;
  try {
    data = await rawStravaAPI(interpolateEndpoint(endpoint), query);
    if (data.status === 401) needsLogin = true;
  } catch (e) {
    if (e instanceof NeedsLogin) needsLogin = true;
    else throw e;
  }
  if (needsLogin) {
    await getAccessTokenFromBrowser();
    endpoint = interpolateEndpoint(endpoint);
    data = await rawStravaAPI(interpolateEndpoint(endpoint), query);
  }
  const json = await data.json();

  return json;
}

async function getActivitiesPage(i: number, start?: number, end?: number): Promise<unknown[]> {
  return stravaAPI('/athlete/activities', {
    per_page: 200,
    page: i,
    before: Math.floor(end),
    after: Math.floor(start),
  });
}

/**
 * Fetches your data from the Strava API
 */
export async function* getStravaActivitiesPages(
  start: number = undefined,
  end: number = undefined,
): AsyncGenerator<unknown[], void, undefined> {
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const page = await getActivitiesPage(i, start, end);
    if (!page || !page.length) console.log(page, i, start, end);
    console.log('page', i, 'has length', page.length);
    if (!page.length) break;
    yield page;
    i += 1;
  }
}

/**
 * Fetches your data from the Strava API
 */
export async function* getStravaActivities(
  start: number = undefined,
  end: number = undefined,
): AsyncGenerator<unknown, void, undefined> {
  // eslint-disable-next-line no-restricted-syntax
  for await (const page of getStravaActivitiesPages(start, end)) {
    yield* page;
  }
}

async function getRoutesPage(i: number): Promise<unknown[]> {
  return stravaAPI('/athletes/{athlete}/routes', {
    per_page: 200,
    page: i,
  });
}

/**
 * Fetches your data from the Strava API
 */
export async function* getStravaRoutesPages(): AsyncGenerator<unknown[], void, undefined> {
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const page = await getRoutesPage(i);
    console.log('route page', i, 'has length', page.length);
    if (!page.length) break;
    yield page;
    i += 1;
  }
}

/**
 * Fetches your data from the Strava API
 */
export async function* getStravaRoutes(): AsyncGenerator<unknown, void, undefined> {
  // eslint-disable-next-line no-restricted-syntax
  for await (const page of getStravaRoutesPages()) {
    yield* page;
  }
}

export async function getActivity(id: number): Promise<unknown> {
  return await stravaAPI(`/activities/${id}`);
}
