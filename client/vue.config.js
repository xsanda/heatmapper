module.exports = {
  chainWebpack(config) {
    config.plugin('html').tap((args) => {
      const [arg, rest] = args;
      return [{ ...arg, title: 'Heatmapper' }, rest];
    });
  },
  configureWebpack: {
    resolve: { extensions: ['*', '.vue', '.js'] },
  },
  devServer: {
    hot: true,
    port: 8080,
    proxy: {
      '^/api/': { target: 'http://localhost:3000/' },
    },
  },
};
