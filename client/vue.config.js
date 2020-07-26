const Webpack = require('webpack');

module.exports = {
  chainWebpack(config) {
    config.plugin('html').tap((args) => {
      const [arg, rest] = args;
      return [{ ...arg, title: 'Heatmapper' }, rest];
    });
  },
  configureWebpack: {
    resolve: { extensions: ['*', '.vue', '.js', '.ts'] },
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
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules|vue\/src/,
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/],
          },
        },
      ],
    },
  },
  devServer: {
    hot: true,
    port: 8080,
    proxy: {
      '^/api/': { target: 'http://localhost:3000/' },
    },
  },
};
