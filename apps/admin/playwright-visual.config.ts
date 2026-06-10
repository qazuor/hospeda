/**
 * @file playwright-visual.config.ts
 * @description SPEC-153 T-153-32 — Visual snapshot config for apps/admin.
 *
 * Mirrors apps/web/playwright-visual.config.ts but for the authenticated
 * admin dashboard. These snapshots are a REFERENCE STARTING POINT for
 * future admin visual work (e.g. SPEC-155 dashboards) — NOT a regression
 * gate. They document how the admin looks after adopting @repo/design-tokens
 * (river brand, Geologica/Roboto, light + dark).
 *
 * Admin pages are auth-gated, so an `auth.setup.ts` project logs in once
 * (via the API email/password endpoint) and saves the Better Auth session
 * to a storageState file; the capture project reuses it. Provide creds via
 * env (no secret is committed):
 *
 *   VISUAL_TEST_ADMIN_EMAIL=superadmin@hospeda.com \
 *   VISUAL_TEST_ADMIN_PASSWORD=... \
 *   VISUAL_TEST_NO_WEBSERVER=1 VISUAL_TEST_BASE_URL=http://localhost:3000 \
 *   pnpm exec playwright test --config=playwright-visual.config.ts --update-snapshots
 *
 * The API must be running (default http://localhost:3001) so the login +
 * session checks resolve.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.VISUAL_TEST_BASE_URL ?? 'http://localhost:3000';
const SNAPSHOT_DIR = process.env.VISUAL_TEST_SNAPSHOT_DIR ?? 'baseline';
const STORAGE_STATE = 'tests/visual-snapshots/.auth/admin.json';

const VIEWPORTS = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 },
    wide: { width: 1920, height: 1080 }
} as const;

export default defineConfig({
    testDir: './tests/visual-snapshots',
    testMatch: /.*\.(visual|setup)\.ts$/,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-visual-report' }]],

    snapshotPathTemplate: `tests/visual-snapshots/${SNAPSHOT_DIR}/{arg}{ext}`,

    expect: {
        timeout: 20_000,
        toHaveScreenshot: {
            // Reference snapshots, not a strict gate — generous threshold.
            maxDiffPixelRatio: 0.01,
            animations: 'disabled',
            caret: 'hide',
            scale: 'css'
        }
    },

    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'off',
        video: 'off',
        actionTimeout: 15_000,
        navigationTimeout: 60_000,
        colorScheme: 'light',
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires'
    },

    projects: [
        // Logs in once and saves the session; the capture projects depend on it.
        { name: 'setup', testMatch: /auth\.setup\.ts$/ },
        {
            name: 'mobile',
            use: { ...devices['Pixel 7'], viewport: VIEWPORTS.mobile, storageState: STORAGE_STATE },
            dependencies: ['setup']
        },
        {
            name: 'tablet',
            use: {
                browserName: 'chromium',
                viewport: VIEWPORTS.tablet,
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: true,
                storageState: STORAGE_STATE
            },
            dependencies: ['setup']
        },
        {
            name: 'desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: VIEWPORTS.desktop,
                storageState: STORAGE_STATE
            },
            dependencies: ['setup']
        },
        {
            name: 'wide',
            use: {
                ...devices['Desktop Chrome'],
                viewport: VIEWPORTS.wide,
                storageState: STORAGE_STATE
            },
            dependencies: ['setup']
        }
    ],

    webServer: process.env.VISUAL_TEST_NO_WEBSERVER
        ? undefined
        : {
              command: 'pnpm dev',
              url: BASE_URL,
              reuseExistingServer: true,
              stdout: 'ignore',
              stderr: 'pipe',
              timeout: 180_000
          }
});
