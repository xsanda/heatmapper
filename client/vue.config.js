const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

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
      new MomentLocalesPlugin({
        localesToKeep: ['en-gb'],
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
};
