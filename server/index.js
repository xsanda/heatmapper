import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
import moment from 'moment/min/moment-with-locales';
import { getStravaActivities, getStravaActivityPages } from './strava.js';

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

function* chunkArray(array, n = 10) {
  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n);
  }
}

const formatDateWithLineBreak = (() => {
  function splitDateFormat(format) {
    // break at the last word boundary after year before day/month
    const yearFirstRegex = /^([^DMY]*Y+(?:[^DMY]*[^DMY ])?(?:\b|(?= ))) ?([^MD]*[MD]+.*)$/;

    // break at the first word boundary after day/month before year
    const yearLastRegex = /^([^Y]*[MD](?:[^Y]*?[^Y ])??\b[.,]?) ?((?![,.]).*?Y+[^DMY]*)$/;
    const matches = yearFirstRegex.exec(format) || yearLastRegex.exec(format);
    if (matches) return matches.slice(1);
    return [format];
  }

  const memo = {};
  function memoisedSplitDateFormat(locales) {
    const format = moment.localeData(locales).longDateFormat('ll');
    const cachedSplitFormat = memo[format];
    if (cachedSplitFormat) return cachedSplitFormat;

    const splitFormat = splitDateFormat(format);
    memo[format] = splitFormat;
    return splitFormat;
  }

  return (date, locales) => {
    const dateMoment = moment(date).locale(locales);
    const format = memoisedSplitDateFormat(locales);
    return format.map((line) => dateMoment.format(line));
  };
})();


function convertActivity({
  id, name, start_date_local: date, map: { summary_polyline: map }, type,
}, locales = ['en']) {
  return {
    id, name, date, map, type, dateString: formatDateWithLineBreak(date, locales),
  };
}

function filterActivities(activities, type = undefined) {
  return activities.filter((activity) => (
    activity.map
    && (!type || type.split(',').includes(activity.type))
  ));
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
  const filteredActivities = filterActivities(cachedActivities, req.query.type);
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
  const sendStats = () => ws.send(JSON.stringify(stats));

  ws.on('close', () => { live = false; });

  if (cachedActivities.length === 0) {
    const activities = [];

    stats.finding.started = true;
    sendStats();

    // eslint-disable-next-line no-restricted-syntax
    for await (const page of getStravaActivityPages()) {
      if (!live) return;

      stats.finding.length = activities.length + page.length;
      sendStats();

      activities.push(...page.map((activity) => convertActivity(activity, locales)));
    }
    cachedActivities = activities;
  } else {
    stats.finding.started = true;
    stats.finding.length = cachedActivities.length;
  }
  if (!live) return;

  stats.finding.finished = true;
  stats.filtering.started = true;
  sendStats();

  const filteredActivities = filterActivities(cachedActivities, req.query.type);
  stats.filtering.finished = true;
  stats.filtering.length = filteredActivities.length;
  sendStats();
  ws.send(JSON.stringify({ type: 'activities', activities: filteredActivities.map(({ map, ...activity }) => activity) }));

  stats.maps.started = true;
  sendStats();

  // eslint-disable-next-line no-restricted-syntax
  for (const chunk of chunkArray(filteredActivities, 50)) {
    const maps = Object.fromEntries(chunk.map(({ id, map }) => [id, map]));
    ws.send(JSON.stringify({ type: 'maps', chunk: maps }));
  }
  stats.maps.finished = true;
  sendStats();
  ws.close();
});

app.use('/api', router);

app.listen(port, () => console.log(`Heatmapper backend listening on port ${port}!`));
