"use strict";

import path from 'node:path';
import url from 'node:url';

const mode = process.env.NODE_ENV || "development";
const development = mode === "development";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  mode,
  experiments: {
    outputModule: true,
  },
  optimization: {
    // We must not mangle export names, because RSC actions are called by name
    mangleExports: false,
  },
  entry: "./src/index.js",
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: "babel-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
    conditionNames: [
      '...',
      'react-server',
      'edge-light',
    ],
  },
  output: {
    chunkFilename: development
      ? "[id].chunk.js"
      : "[id].[contenthash].chunk.js",
    publicPath: '/client/',
    filename: "[name].js",
    clean: true,
    library: {
      type: "module"
    },
    path: path.resolve(__dirname, "build"),
  },
  devtool: development ? "cheap-module-source-map" : "source-map",
  externals: [
    ({request,}, callback) => {
      // Allow Webpack to handle fastly:* namespaced module imports by treating
      // them as modules rather than try to process them as URLs
      // We only allow this on the origin build ('use server' components)
      if (/^fastly:.*$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
};

export default config;
