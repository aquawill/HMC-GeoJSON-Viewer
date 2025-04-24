const path = require("path");

module.exports = {
  mode: "development",
  entry: "./renderer.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "renderer.bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    fallback: {
      fs: false,
    },
  },
  experiments: {
    topLevelAwait: true,
  },
};
