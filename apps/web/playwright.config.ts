/**
 * Playwright E2E configuration for the Hospeda web application.
 *
 * Runs browser-based tests against a running dev environment.
 * Requires both the web app (port 4321) and API (port 3001) to be running.
 *
 * Usage:
 *   pnpm --filter hospeda-web test:e2e           # Run all E2E tests
 *   pnpm --filter hospeda-web test:e2e:ui        # Run with Playwright UI mode
 *   pnpm --filter hospeda-web test:e2e:headed    # Run in headed browser mode
 */
import { defineConfig, devices } from '@playwright/test';

/** Web app base URL */
const WEB_BASE_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4321';

/** API base URL */
const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

export default defineConfig({
    testDir: './test/e2e',
    outputDir: './test/e2e/.results',

    /* Fail fast in CI, retry locally */
    retries: process.env.CI ? 2 : 0,
    fullyParallel: true,

    /* Reasonable timeouts for local dev */
    timeout: 30_000,
    expect: { timeout: 5_000 },

    /* Reporter */
    reporter: process.env.CI ? 'github' : 'list',

    use: {
        baseURL: WEB_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],

    /* Pass API URL to tests via env */
    metadata: {
        apiBaseUrl: API_BASE_URL
    }
});
