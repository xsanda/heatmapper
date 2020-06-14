#!/usr/bin/env node

// @ts-check

import { createServer } from 'http';
import fetch from 'node-fetch';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'url';
import fp from 'find-free-port';
import dotenv from 'dotenv';

dotenv.config();

const {
  STRAVA_REFRESH_TOKEN: stravaRefreshToken,
  STRAVA_CLIENT_ID: stravaClientId,
  STRAVA_CLIENT_SECRET: stravaClientSecret,
} = process.env;

const AUTH_CACHE_FILE = 'strava-auth.json';

const cache = { stravaRefreshToken };

/**
 * Updates cached strava authentication tokens if necessary
 *
 * @param {{ code: string | string[]; grant_type: string; } =} tokens
 * @returns {Promise<string>}
 */
async function getStravaToken(tokens = undefined) {
  if (!tokens && cache.stravaAccessToken) return cache.stravaAccessToken;

  // read cache from disk
  try {
    const jsonStr = readFileSync(AUTH_CACHE_FILE, 'utf-8');
    Object.assign(cache, JSON.parse(jsonStr));
  } catch (error) {
    console.log(error);
  }
  console.debug(`ref: ${cache.stravaRefreshToken.substring(0, 6)}`);

  // get new tokens
  const data = await fetch('https://www.strava.com/oauth/token', {
    method: 'post',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      ...(tokens || { refresh_token: cache.stravaRefreshToken }),
    }),
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => res.json());
  cache.stravaAccessToken = data.access_token;
  cache.stravaRefreshToken = data.refresh_token;

  // save to disk
  writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cache));

  return cache.stravaAccessToken;
}

/**
 * @param {string} endpoint
 * @param {object} query
 */
async function rawStravaAPI(endpoint, query = {}) {
  const API_BASE = 'https://www.strava.com/api/v3';
  const queryString = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const API = `${API_BASE}${endpoint}?${queryString}`;

  const data = await fetch(API, {
    headers: { Authorization: `Bearer ${await getStravaToken()}` },
  });
  return data;
}

/**
 * @returns {Promise<void>}
 */
async function getAccessTokenFromBrowser() {
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

/**
 * @param {string} endpoint
 * @param {object} query
 * @returns {Promise<object>}
 */
async function stravaAPI(endpoint, query = {}) {
  let data = await rawStravaAPI(endpoint, query);
  if (data.status === 401) {
    await getAccessTokenFromBrowser();
    data = await rawStravaAPI(endpoint, query);
  }
  const json = await data.json();

  return json;
}

async function getPage(i) {
  return stravaAPI('/athlete/activities', {
    per_page: 200,
    page: i,
  });
}

/**
 * Fetches your data from the Strava API
 * @returns {AsyncGenerator<unknown[]>}
 */
export async function* getStravaActivityPages() {
  let page;
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    page = await getPage(i);
    console.log('page', i, 'has length', page.length);
    if (page.length === 0) break;
    yield page;
    i += 1;
  }
}

/**
 * Fetches your data from the Strava API
 * @returns {AsyncGenerator<unknown>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function* getStravaActivities() {
  // eslint-disable-next-line no-restricted-syntax
  for await (const page of getStravaActivityPages()) {
    yield* page;
  }
}
