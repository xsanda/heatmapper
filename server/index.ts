// @ts-check

import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
import history from 'connect-history-api-fallback';
import moment from 'moment';
import 'moment/min/locales';
import { createReadStream, existsSync } from 'fs';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import {
  Activity,
  RequestMessage,
  ResponseMessage,
  StatsMessage,
  TimeRange,
  Route,
  ActivityMap,
} from '../shared/interfaces';
import { Strava, tokenExchange } from './strava';
import eagerIterator, { tick } from './eager-iterator';
import { inOrder, memoize } from './stateful-functions';
import { validate as validateUUID } from 'uuid';

dotenv.config();

const app = express();
expressWs(app);
app.use(cookieParser());
const port = 3000;
const router = express.Router();
const domain = process.env.DOMAIN || `http://localhost:${port}`;

app.use(bodyParser.json());

function corsConfig(req, res, next) {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
}

app.use(corsConfig);

function* chunkArray<T>(array: T[], n: number = 10): Generator<T[]> {
  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n);
  }
}

async function* chunkAsync<T>(array: Promise<T>[], n: number = 10): AsyncGenerator<T[]> {
  for (let i = 0; i < array.length; i += n) {
    yield Promise.all(array.slice(i, i + n));
  }
}

const splitDateFormat = memoize((format) => {
  // break at the last word boundary after year before day/month
  const yearFirstRegex = /^([^DMY]*Y+(?:[^DMY]*[^DMY ])?(?:\b|(?= ))) ?([^MD]*[MD]+.*)$/;

  // break at the first word boundary after day/month before year
  const yearLastRegex = /^([^Y]*[MD](?:[^Y]*?[^Y ])??\b[.,]?) ?((?![,.]).*?Y+[^DMY]*)$/;
  const matches = yearFirstRegex.exec(format) || yearLastRegex.exec(format);
  if (matches) return matches.slice(1);
  return [format];
});

function formatDateWithLineBreak(date: moment.MomentInput, locales: string | string[]): string[] {
  const dateMoment = moment(date).locale(locales);
  const format = moment.localeData(locales).longDateFormat('ll');
  const splitFormat = splitDateFormat(format);
  return splitFormat.map((line) => dateMoment.format(line));
}

function convertActivitySummary(
  { id, name, start_date_local: date, map: { summary_polyline: map }, type },
  locales: string | string[] = ['en'],
): Activity {
  return {
    id,
    name,
    date: +new Date(date),
    map,
    type,
    dateString: formatDateWithLineBreak(date, locales),
  };
}

function convertRouteSummary(
  { id_str, name, created_at: date, map: { summary_polyline: map }, type, sub_type: subType },
  locales: string | string[] = ['en'],
): Route {
  return {
    route: true,
    id: id_str,
    name,
    date,
    map,
    type: { 1: 'Ride', 2: 'Run' }[type],
    subType: { 1: 'Road', 2: 'MountainBike', 3: 'Cross', 4: 'Trail', 5: 'Mixed' }[subType],
    dateString: formatDateWithLineBreak(date, locales),
  };
}

function convertActivity({ id, map }, highDetail = false): ActivityMap {
  try {
    return { id, map: highDetail ? map.polyline : map.summary_polyline };
  } catch (e) {
    if (!map) {
      console.error('No map for activity', id);
      return { id, map: '' };
    } else throw e;
  }
}

/**
 * Sort promises by execution time, instantly.
 */
function sortPromises<T>(promises: Promise<T>[]): Promise<T>[] {
  const sorted: Promise<T>[] = [];
  const resolvers: ((value: T) => void)[] = [];
  let resolved = 0;
  promises.forEach((promise) => {
    sorted.push(new Promise((resolve) => resolvers.push(resolve)));
    promise.then((value) => resolvers[resolved++](value));
  });
  return sorted;
}

router.ws('/activities', (ws, req) => {
  function send(data: ResponseMessage) {
    ws.send(JSON.stringify(data));
  }

  const fetchedMaps: Map<string, string> = new Map();

  const locales = req.acceptsLanguages();

  async function requestLogin(token: string, url: string) {
    send({ type: 'login', cookie: token, url });
  }

  let strava = new Strava(domain, req.cookies['token'], requestLogin);

  let live = true;
  const stats: StatsMessage = {
    type: 'stats',
    finding: { started: false, finished: false, length: 0 },
  };
  const sendStats = () => {
    if (live) send(stats as ResponseMessage);
  };

  ws.on('close', () => {
    live = false;
  });

  // TODO: cache this sensibly
  /**
   * Fetches your data from the Strava API
   */
  async function* activitiesIterator(start?: number, end?: number): AsyncGenerator<Activity[]> {
    // eslint-disable-next-line no-restricted-syntax
    for await (const page of eagerIterator(strava.getStravaActivitiesPages(start, end))) {
      if (!live) return;

      stats.finding.length += page.length;
      sendStats();

      const newActivities = page
        .map((activity) => convertActivitySummary(activity as any, locales))
        .filter((activity) => activity.map);
      if (newActivities.length) {
        yield newActivities;
      }
    }

    stats.finding.finished = true;
  }

  /**
   * Fetches your routes from the Strava API
   */
  async function* routesIterator(): AsyncGenerator<Route[]> {
    const routes: Route[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const page of eagerIterator(strava.getStravaRoutesPages())) {
      if (!live) return;

      stats.finding.length = routes.length + page.length;
      sendStats();

      const newRoutes = page.map((route) => convertRouteSummary(route as any, locales)).filter((route) => route.map);
      routes.push(...newRoutes);
      yield newRoutes;
    }

    stats.finding.finished = true;
  }

  const sendMaps = inOrder(async (activities: string[]) => {
    const activityMaps = sortPromises(
      activities.map(async (id) => {
        const highDetail = false;
        await tick();
        let map = fetchedMaps.get(id);
        if (map) fetchedMaps.delete(id);
        if (map && !highDetail) return [id, map];
        else map = convertActivity((await strava.getActivity(id)) as any, highDetail).map;
        return [id, map];
      }),
    );
    for await (const chunk of chunkAsync(activityMaps, 50)) {
      // eslint-disable-next-line no-await-in-loop
      if (!live) return;
      const maps = Object.fromEntries(chunk);
      send({ type: 'maps', chunk: maps } as ResponseMessage);
    }
    sendStats();
  });

  ws.on('message', async (data) => {
    const message: RequestMessage = JSON.parse(data.toString());
    if (message.activities) {
      stats.finding.started = true;

      // eslint-disable-next-line no-restricted-syntax
      for (const { start, end } of TimeRange.cap(message.activities)) {
        sendStats();
        // eslint-disable-next-line no-restricted-syntax, no-await-in-loop
        for await (const activities of activitiesIterator(start, end)) {
          if (!live) return;
          activities.forEach(({ map, id }) => {
            fetchedMaps.set(id.toString(), map);
          });
          send({
            type: 'activities',
            activities: activities.map(({ map, ...activity }) => activity),
          } as ResponseMessage);
          sendStats();
        }

        if (!live) return;
        sendStats();
      }
    }

    if (message.routes) {
      stats.finding.started = true;

      sendStats();
      // eslint-disable-next-line no-restricted-syntax, no-await-in-loop
      for await (const routes of routesIterator()) {
        if (!live) return;
        routes.forEach(({ map, id }) => {
          fetchedMaps.set(id, map);
        });
        send({
          type: 'routes',
          routes: routes.map(({ map, ...routes }) => routes),
        } as ResponseMessage);
        sendStats();
      }

      if (!live) return;
      sendStats();
    }

    if (message.maps) {
      sendMaps(message.maps);
    }
  });
});

router.get('/token', (req, res) => {
  const successful = tokenExchange(req.query as any);
  if (validateUUID(req.query.state as string)) {
    // 1 year
    res.cookie('token', req.query.state, { maxAge: 31536000 });
  }
  const [code, html] = successful ? [200, 'auth.html'] : [400, 'auth-error.html'];
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
  createReadStream(html).pipe(res);
});

app.use('/api', router);

// Middleware for serving '/dist' directory
const staticFileMiddleware = express.static('../client/dist');

// 1st call for unredirected requests
app.use(staticFileMiddleware);

// Support history api
app.use(
  history({
    index: '../client/dist/index.html',
  }),
);

// 2nd call for redirected requests
app.use(staticFileMiddleware);

app.listen(port, () => console.log(`Heatmapper backend listening on port ${port}!`));
