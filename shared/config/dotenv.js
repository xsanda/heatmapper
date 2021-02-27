/* eslint-disable @typescript-eslint/no-var-requires */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '../.env') });

const SERVER_PORT = process.env.SERVER_PORT || 8080;
const VUE_DEV_PORT = process.env.VUE_DEV_PORT || 8081;
const SERVER_DOMAIN = process.env.DOMAIN || `http://localhost:${SERVER_PORT}`;

module.exports = {
  SERVER_PORT,
  VUE_DEV_PORT,
  SERVER_DOMAIN,
};
