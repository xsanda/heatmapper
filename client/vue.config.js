module.exports = {
  chainWebpack(config) {
    config.plugin('html').tap((args) => {
      args[0].title = 'Heatmapper';
      return args;
    });
    config.resolve.alias.set('!', '.');
  },
  configureWebpack: {
    resolve: { extensions: ['*', '.ts', '.vue', '.js'] },
  },
};
