import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against the production build (`vite build && vite preview`,
 * the same handler the Worker runs). Point E2E_BASE_URL at a deployment to
 * run the same suite there:
 *
 *   E2E_BASE_URL=https://solid-domains.doeixd.workers.dev npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5197'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    // The installed Chrome: no browser download needed.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 5197 --strictPort',
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
