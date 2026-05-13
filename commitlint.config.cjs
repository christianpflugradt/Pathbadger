/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => message.trim() === "inital commit"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "web",
        "api",
        "geo",
        "shared",
        "routing",
        "tiles",
        "docker",
        "agent",
        "docs",
        "qa",
        "deps",
      ],
    ],
  },
};
