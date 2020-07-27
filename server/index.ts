// @ts-check

import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
import history from 'connect-history-api-fallback';
import moment from 'moment';
import 'moment/min/locales';

import {
  Activity,
  RequestMessage,
  ResponseMessage,
  StatsMessage,
  TimeRange,
} from '../shared/interfaces';

import { getStravaActivityPages } from './strava';
import eagerIterator, { tick } from './eager-iterator';
import { inOrder, memoize } from './stateful-functions';
import { existsSync } from 'fs';

const app = express();
expressWs(app);
const port = 3000;
const router = express.Router();

app.use(bodyParser.json());

function corsConfig(req, res, next) {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  next();
}

app.use(corsConfig);

if (existsSync('../client/dist')) {
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
}

/**
 * @template T
 * @param {T[]} array
 * @param {number} n
 * @returns {Generator<T[]>}
 */
function* chunkArray<T>(array: T[], n: number = 10): Generator<T[]> {
  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n);
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

function convertActivity(
  { id, name, start_date_local: date, map: { summary_polyline: map }, type },
  locales: string | string[] = ['en'],
): Activity {
  return {
    id,
    name,
    date,
    map,
    type,
    dateString: formatDateWithLineBreak(date, locales),
  };
}

/** @type {Activity[]} */
let cachedActivities: Activity[] = [];

router.ws('/activities', async (ws, req) => {
  /** @type {Map<number, string>} */
  const fetchedMaps: Map<number, string> = new Map();

  const locales = req.acceptsLanguages();

  let live = true;
  const stats: StatsMessage = {
    type: 'stats',
    finding: { started: false, finished: false, length: 0 },
  };
  const sendStats = () => {
    if (live) ws.send(JSON.stringify(stats as ResponseMessage));
  };

  ws.on('close', () => {
    live = false;
  });

  /**
   * Fetches your data from the Strava API
   */
  async function* activitiesIterator(start?: number, end?: number): AsyncGenerator<Activity[]> {
    if (cachedActivities.length === 0) {
      const activities = [];

      // eslint-disable-next-line no-restricted-syntax
      for await (const page of eagerIterator(getStravaActivityPages(start, end))) {
        if (!live) return;

        stats.finding.length = activities.length + page.length;
        sendStats();

        const newActivities = page
          .map((activity) => convertActivity(activity as any, locales))
          .filter((activity) => activity.map);
        activities.push(...newActivities);
        yield newActivities;
      }
      cachedActivities = activities;
    } else {
      stats.finding.started = true;
      stats.finding.length = cachedActivities.length;
      sendStats();
      yield cachedActivities;
    }
    stats.finding.finished = true;
  }

  const sendMaps: (input?: { id: number; map: string }[]) => Promise<void> = inOrder(
    async (activities = []) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunkArray(activities, 50)) {
        // eslint-disable-next-line no-await-in-loop
        await tick();
        if (!live) return;
        const maps = Object.fromEntries(chunk.map(({ id, map }) => [id, map]));
        ws.send(JSON.stringify({ type: 'maps', chunk: maps } as ResponseMessage));
      }
      sendStats();
    },
  );

  ws.on('message', async (data) => {
    const message: RequestMessage = JSON.parse(data.toString());

    if (message.load) {
      // eslint-disable-next-line no-restricted-syntax
      for (const { start, end } of TimeRange.cap(message.load)) {
        sendStats();
        // eslint-disable-next-line no-restricted-syntax, no-await-in-loop
        for await (const activities of activitiesIterator(start, end)) {
          if (!live) return;
          activities.forEach(({ map, id }) => {
            fetchedMaps.set(id, map);
          });
          ws.send(
            JSON.stringify({
              type: 'activities',
              activities: activities.map(({ map, ...activity }) => activity),
            } as ResponseMessage),
          );
          sendStats();
        }

        if (!live) return;
        sendStats();
      }
    }

    if (message.maps) {
      const mapsToSend = message.maps.map((id) => {
        const map = fetchedMaps.get(id);
        fetchedMaps.delete(id);
        return { id, map };
      });
      sendMaps(mapsToSend);
    }
  });

  // ws.close();
});

app.use('/api', router);

app.listen(port, () => console.log(`Heatmapper backend listening on port ${port}!`));
