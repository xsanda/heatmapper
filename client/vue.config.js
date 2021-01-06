/* eslint-disable @typescript-eslint/no-var-requires */
const Webpack = require('webpack');

module.exports = {
  chainWebpack(config) {
    config.plugin('html').tap((args) => {
      const [arg, rest] = args;
      return [{ ...arg, title: 'Heatmapper' }, rest];
    });
  },
  configureWebpack: {
    resolve: { extensions: ['*', '.vue', '.js'] },
    optimization: {
      splitChunks: {
        minSize: 10000,
        maxSize: 250000,
      },
    },
    plugins: [
      new Webpack.ProvidePlugin({
        mapboxgl: 'mapbox-gl',
      }),
    ],
  },
  devServer: {
    hot: true,
    port: 8080,
    proxy: {
      '^/api/': { target: 'http://localhost:3000/' },
    },
  },
  outputDir: '../dist/client',
  productionSourceMap: false,
};
