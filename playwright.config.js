const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  expect: { timeout: 30000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown'),
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
});
