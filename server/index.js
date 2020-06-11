import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
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

app.use(corsConfig);

let cachedActivities = [];

router.get('/activities', async (req, res) => {
  if (cachedActivities.length === 0) {
    const activities = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const {
      id, name, start_date_local: date, map: { summary_polyline: map }, type,
    } of getStravaActivities()) {
      activities.push({
        id, name, date, map, type,
      });
    }
    cachedActivities = activities;
  }
  let filteredActivities = cachedActivities;
  if (req.query.type) {
    filteredActivities = filteredActivities.filter((activity) => req.query.type.split(',').includes(activity.type));
  }
  res.send(filteredActivities);
});

router.ws('/activities', async (ws, req) => {
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

      activities.push(...page.map(({
        id, name, start_date_local: date, map: { summary_polyline: map }, type,
      }) => ({
        id, name, date, map, type,
      })));
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

  let filteredActivities = cachedActivities;
  if (req.query.type) {
    filteredActivities = filteredActivities.filter((activity) => req.query.type.split(',').includes(activity.type));
  }
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
