const development = (process.env.NODE_ENV || "development") === "development";

export default {
  presets: [
    [
      "@babel/preset-react",
      {
        runtime: "automatic",
        useSpread: true,
        development,
      },
    ],
  ],
};
