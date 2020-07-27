const path = require('path');
const webpack = require('webpack');
const { generateReleaseInfo } = require('@material-ui/x-license');

const env = process.env.NODE_ENV || 'development'
/* eslint-disable */
const __DEV__ = env === 'development'
const __PROD__ = env === 'production'
/* eslint-enable */

if (!(__DEV__ || __PROD__)) {
  throw new Error(`Unknown env: ${env}.`)
}
console.log(`Loading config for ${env}`)
const maxAssetSize = 1024 * 1024;

module.exports = {
  stories: ['../src/**/*.stories.*'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-viewport/register',
    '@storybook/addon-knobs/register',
    '@storybook/addon-actions/register',
    '@storybook/addon-storysource/register',
    '@storybook/addon-a11y/register',
  ],
  webpackFinal: async config => {
    config.devtool = __DEV__ ? 'inline-source-map' : undefined;
    config.module.rules.push({
      test: /\.(js|ts|tsx)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: {
        cacheDirectory: true,
      },
    });

    if (__DEV__) {
      config.module.rules.push({
        test: /\.(js|ts|tsx)$/,
        use: ['source-map-loader'],
        enforce: 'pre',
      });
    }

    config.module.rules.push({
      test: /\.stories\.tsx?$/,
      loaders: [
        {
          loader: require.resolve('@storybook/source-loader'),
          options: {
            parser: 'typescript',
            prettierConfig: {printWidth: 80, singleQuote: true},
            tsconfigPath: path.resolve(__dirname, '../tsconfig.json'),
          },
        },
      ],
      enforce: 'pre',
    });

    config.module.rules.push({
      test: /\.(js|ts|tsx)$/,
      loader: 'string-replace-loader',
      options: {
        search: '__RELEASE_INFO__',
        replace: generateReleaseInfo(),
      }
    });

    config.optimization = {
      splitChunks: {
        chunks: 'all',
        minSize: 30 * 1024,
        maxSize: maxAssetSize,
      }
    };
    config.performance = {
      maxAssetSize: maxAssetSize
    };
    config.resolve = {
      ...config.resolve,
      extensions: ['.js', '.ts', '.tsx'],
      modules: [path.join(__dirname, '../../../'), 'node_modules'],
    };
    return config;
  },
};