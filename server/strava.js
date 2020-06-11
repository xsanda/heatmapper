#!/usr/bin/env node

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
 */
async function getStravaToken(tokens = undefined) {
  if (!tokens && cache.stravaAccessToken) return cache.stravaAccessToken;

  // read cache from disk
  try {
    const jsonStr = readFileSync(AUTH_CACHE_FILE);
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

async function getAccessTokenFromBrowser() {
  const [port] = await fp(10000);
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const requestUrl = parse(request.url, { parseQueryString: true });
      if (requestUrl.pathname !== '/strava-token') {
        console.debug(`Ignoring request to ${requestUrl.pathname}`);
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('Complete, you may now close this window');
      response.end();
      await server.close();
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
 */
// eslint-disable-next-line import/prefer-default-export
export async function* getFullStravaActivities() {
  let page;
  let i = 1;
  do {
    // eslint-disable-next-line no-await-in-loop
    page = await getPage(i);
    console.log('page', i, 'has length', page.length);
    i += 1;
    yield* page;
  } while (page.length);
}
