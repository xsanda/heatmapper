// @ts-check

import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
import moment from 'moment';
import 'moment/min/locales';
import { getStravaActivities, getStravaActivityPages } from './strava.js';
import eagerIterator from './eager-iterator.js';

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

/**
 * @template T
 * @param {T[]} array
 * @param {number} n
 * @returns {Generator<T[]>}
 */
function* chunkArray(array, n = 10) {
  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n);
  }
}

/**
 * Memoise a function, so previously passed values are stored to avoid recomputation.
 *
 * Note that this will lead to a memory leak if too many inputs are given: they are never cleared.
 * The function must take a single string.
 *
 * @template T
 * @param {(arg: string) => T} fn The function to memoise.
 * @returns {(arg: string) => T} The memoised function.
 */
const memoise = (fn) => {
  const memo = {};

  return (arg) => {
    const cached = memo[arg];
    if (cached) return cached;

    const computed = fn(arg);
    memo[arg] = computed;
    return computed;
  };
};

/**
 * @template T
 * @param {(activities: T) => Promise<void>} fn
 * @returns {(input: T) => Promise<void>}
 */
const inOrder = (fn) => {
  let lastItem = Promise.resolve();
  return (input) => {
    lastItem = lastItem.then(() => fn(input));
    return lastItem;
  };
};

/**
 * @returns {Promise<void>}
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const splitDateFormat = memoise((format) => {
  // break at the last word boundary after year before day/month
  const yearFirstRegex = /^([^DMY]*Y+(?:[^DMY]*[^DMY ])?(?:\b|(?= ))) ?([^MD]*[MD]+.*)$/;

  // break at the first word boundary after day/month before year
  const yearLastRegex = /^([^Y]*[MD](?:[^Y]*?[^Y ])??\b[.,]?) ?((?![,.]).*?Y+[^DMY]*)$/;
  const matches = yearFirstRegex.exec(format) || yearLastRegex.exec(format);
  if (matches) return matches.slice(1);
  return [format];
});

/**
 * @param {moment.MomentInput} date
 * @param {string | string[]} locales
 * @returns {string[]}
 */
const formatDateWithLineBreak = (date, locales) => {
  const dateMoment = moment(date).locale(locales);
  const format = moment.localeData(locales).longDateFormat('ll');
  const splitFormat = splitDateFormat(format);
  return splitFormat.map((line) => dateMoment.format(line));
};

/**
 * @typedef {object} Activity
 * @property {string} id
 * @property {string} name
 * @property {moment.MomentInput} date
 * @property {string} map
 * @property {string} type
 * @property {string[]} dateString
 */

/**
 *
 * @param {any} rawActivity
 * @param {string | string[]} locales
 * @returns {Activity}
 */
function convertActivity(
  { id, name, start_date_local: date, map: { summary_polyline: map }, type },
  locales = ['en'],
) {
  return {
    id,
    name,
    date,
    map,
    type,
    dateString: formatDateWithLineBreak(date, locales),
  };
}

/**
 * @param {Activity[]} activities
 * @param {string=} type
 * @return {Activity[]}
 */
function filterActivities(activities, type = undefined) {
  return activities.filter(
    (activity) => activity.map && (!type || type.split(',').includes(activity.type)),
  );
}

app.use(corsConfig);

let cachedActivities = [];

router.get('/activities', async (req, res) => {
  const locales = req.acceptsLanguages();
  if (cachedActivities.length === 0) {
    const activities = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const activity of getStravaActivities()) {
      activities.push(convertActivity(activity, locales));
    }
    cachedActivities = activities;
  }
  const filteredActivities = filterActivities(
    cachedActivities,
    /** @type {string} */ (req.query.type),
  );
  res.send(filteredActivities);
});

router.ws('/activities', async (ws, req) => {
  const locales = req.acceptsLanguages();

  let live = true;
  const stats = {
    type: 'stats',
    finding: { started: false, finished: false, length: 0 },
    filtering: { started: false, finished: false, length: 0 },
    maps: { started: false, finished: false },
  };
  const sendStats = () => {
    if (live) ws.send(JSON.stringify(stats));
  };

  ws.on('close', () => {
    live = false;
  });

  async function* activitiesIterator() {
    if (cachedActivities.length === 0) {
      const activities = [];

      stats.finding.started = true;
      sendStats();

      // eslint-disable-next-line no-restricted-syntax
      for await (const page of eagerIterator(getStravaActivityPages())) {
        if (!live) return;

        stats.finding.length = activities.length + page.length;
        sendStats();

        const newActivities = page.map((activity) => convertActivity(activity, locales));
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

  async function* filteredActivitiesIterator() {
    // eslint-disable-next-line no-restricted-syntax
    for await (const activities of activitiesIterator()) {
      stats.filtering.started = true;
      const filteredActivities = filterActivities(
        activities,
        /** @type {string} */ (req.query.type),
      );
      stats.filtering.length += filteredActivities.length;
      yield filteredActivities;
    }
    stats.filtering.finished = true;
  }

  /**
   * @type {(input?: Activity[]) => Promise<void>}
   */
  const sendMaps = inOrder(async (activities = []) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const chunk of chunkArray(activities, 50)) {
      // eslint-disable-next-line no-await-in-loop
      await tick();
      if (!live) return;
      const maps = Object.fromEntries(chunk.map(({ id, map }) => [id, map]));
      ws.send(JSON.stringify({ type: 'maps', chunk: maps }));
    }
    sendStats();
  });

  if (!live) return;

  sendStats();

  // TODO:  stats.filtering.length = filteredActivities.length;

  // sendStats();

  // eslint-disable-next-line no-restricted-syntax
  for await (const filteredActivities of filteredActivitiesIterator()) {
    if (!live) return;
    ws.send(
      JSON.stringify({
        type: 'activities',
        activities: filteredActivities.map(({ map, ...activity }) => activity),
      }),
    );
    stats.maps.started = true;
    sendStats();
    sendMaps(filteredActivities);
  }

  await sendMaps();
  stats.maps.finished = true;

  if (!live) return;
  sendStats();
  ws.close();
});

app.use('/api', router);

app.listen(port, () => console.log(`Heatmapper backend listening on port ${port}!`));
