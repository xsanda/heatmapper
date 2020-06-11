import bodyParser from 'body-parser';
import express from 'express';
import { getFullStravaActivities } from './strava.js';

const app = express();
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

// app.use(logger);
app.use(corsConfig);

let cachedActivities = [];

router.get('/activities', async (req, res) => {
  if (cachedActivities.length == 0) {
    const activities = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const {
      id, name, start_date_local: date, map: { summary_polyline: map }, type,
    } of getFullStravaActivities()) {
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

app.use('/api', router);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
