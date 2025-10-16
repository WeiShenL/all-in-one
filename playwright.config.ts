import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env file before running tests
dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000, // Longer timeouts in CI/CD
  },

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
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
