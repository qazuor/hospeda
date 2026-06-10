import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Hospeda E2E suite (SPEC-092).
 *
 * Workers and retries are tuned per environment:
 *  - PR runs (E2E_MODE=pr):       4 workers, 1 retry, ~5-6 min target
 *  - Nightly runs (E2E_MODE=nightly): 2 workers, 2 retries, ~30 min target
 *  - Local dev (default):          1 worker, 0 retries (faster feedback)
 *
 * Trace, screenshot, and video are captured on first retry only — keeps
 * artifact storage bounded while still giving full forensics on flakes.
 */

const mode = process.env.E2E_MODE ?? 'local';
const isPR = mode === 'pr';
const isNightly = mode === 'nightly';
const isCI = isPR || isNightly;

const WEB_BASE_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const ADMIN_BASE_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';

export default defineConfig({
    testDir: './tests',
    // Load specs through tsconfig.playwright.json, which clears the inherited
    // `@repo/* -> packages/*/src` path mappings (tsconfig `paths` replace, not
    // merge). Without this, Playwright honors those mappings and loads
    // `@repo/service-core` SOURCE, tripping its babel transform on TS `declare`
    // fields. With paths empty, `@repo/*` resolves to built dist (plain JS).
    tsconfig: './tsconfig.playwright.json',
    fullyParallel: true,
    forbidOnly: isCI,
    workers: isPR ? 4 : isNightly ? 2 : 1,
    retries: isPR ? 1 : isNightly ? 2 : 0,
    timeout: 90_000,
    expect: { timeout: 10_000 },
    reporter: isCI
        ? [
              ['html', { open: 'never', outputFolder: 'playwright-report' }],
              ['json', { outputFile: 'playwright-report/results.json' }],
              ['github']
          ]
        : [['html', { open: 'on-failure', outputFolder: 'playwright-report' }], ['list']],
    use: {
        baseURL: WEB_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        actionTimeout: 15_000,
        navigationTimeout: 30_000
    },
    outputDir: 'test-results',
    projects: [
        {
            name: 'chromium-web',
            use: { ...devices['Desktop Chrome'], baseURL: WEB_BASE_URL }
        },
        {
            name: 'chromium-admin',
            use: { ...devices['Desktop Chrome'], baseURL: ADMIN_BASE_URL }
        }
    ]
});
