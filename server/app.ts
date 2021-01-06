// @ts-check

import bodyParser from 'body-parser';
import express from 'express';
import expressWs from 'express-ws';
import history from 'connect-history-api-fallback';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import apiRouter from './api';

dotenv.config();

const app = express();
expressWs(app);
app.use(cookieParser());
const port = 3000;
const domain = process.env.DOMAIN || `http://localhost:${port}`;

app.use(bodyParser.json());

function corsConfig(req, res, next) {
  res.header('Access-Control-Allow-Origin', domain);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
}

app.use(corsConfig);

app.use('/api', apiRouter(domain));

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

app.listen(port, () => console.log(`Heatmapper backend listening on port ${port}!`));
