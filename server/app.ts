// @ts-check

import bodyParser from 'body-parser';
import history from 'connect-history-api-fallback';
import cookieParser from 'cookie-parser';
import express from 'express';
import expressWs from 'express-ws';

import { SERVER_DOMAIN, SERVER_PORT } from '@strava-heatmapper/shared/config/dotenv';
import apiRouter from './api';

const app = express();
expressWs(app);
app.use(cookieParser());

app.use(bodyParser.json());

function corsConfig(req, res, next) {
  res.header('Access-Control-Allow-Origin', SERVER_DOMAIN);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
}

app.use(corsConfig);

app.use('/api', apiRouter(SERVER_DOMAIN));

const compiledFrontEnd = __filename.includes('/dist/') ? '../client' : '../dist/client';

// Middleware for serving frontend directory
const staticFileMiddleware = express.static(compiledFrontEnd);

// 1st call for unredirected requests
app.use(staticFileMiddleware);

// Support history api
app.use(
  history({
    index: `${compiledFrontEnd}/index.html`,
  }),
);

app.listen(SERVER_PORT, () => {
  console.log(`Heatmapper backend listening on port ${SERVER_PORT}.`);
  console.log(`Visit the latest version at ${SERVER_DOMAIN}/`);
});
