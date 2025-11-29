const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  // Specify the test environment
  testEnvironment: "node",
  // Use ts-jest transform for TypeScript support
  transform: {
    ...tsJestTransformCfg,
  },
  // --- New additions for end-to-end testing ---
  // Where Jest should look for test files
  testMatch: [
    "**/tests/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  // Ignore the 'dist' directory
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/dist/"
  ],
  "transformIgnorePatterns": [
    "/node_modules/(?!@faker-js/faker).+\\.js$"
  ],

  // Set up a global setup script to start the server and DB connection before tests
  // globalSetup: "./tests/setup.ts",
  // Set up a global teardown script to close the server and DB connection after tests
  // globalTeardown: "./tests/teardown.ts",
  // --- End of new additions ---
};
