import { defineConfig, devices } from '@playwright/test'

/* One browser run of the README demo, against the production build.
   Run `npm run build` first; CI does. Unit tests stay in Vitest. */

const PORT = 4174

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
