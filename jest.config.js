// The amount of shit you need just to run some fucking tests in typescript
// is ridiculous
const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  watchPathIgnorePatterns: [
    // Python-based, so no need to monitor
    // Due to the significant number of writes, omitting this basically spams jest tests,
    // which is an unnecessary use of compute
    "integration-test/",
    // Non-project files
    "dist",
    // Non-code files
    ".*\\.md",
    // CSS files don't affect the jest tests
    ".*\\.css",
    // main.js is a generated file that has nothing to do with the jest tests
    "main.js",
  ]
};
// vim:sw=2
