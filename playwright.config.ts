import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env file before running tests
dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: process.env.CI ? 180_000 : 120_000, // Increased to 120s local, 180s CI
  expect: {
    timeout: process.env.CI ? 30_000 : 10_000, // Increased CI timeout from 15s to 30s
  },

  // Retry flaky tests in CI (helps with race conditions)
  retries: process.env.CI ? 2 : 0,

  // Run e2e tests in parallel with worker-specific test data namespacing
  fullyParallel: true,
  workers: process.env.CI ? 3 : 3, // update here if wnat more in local. for now seems like 3 is the sweet spot without any contention issues.

  // Use the dev server's URL for tests; update the port if you use a different one
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Run tests on Chromium by default; enable others if desired
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Start Next.js automatically for the tests and reuse if already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 180_000, // Increased from 120s to 180s
    reuseExistingServer: true,
  },
});
