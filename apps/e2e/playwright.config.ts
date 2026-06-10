import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Repo root: two levels above apps/e2e/playwright.config.ts.
// All `pnpm --filter` commands need cwd = repo root to resolve the workspace.
// ESM-safe: use import.meta.url instead of __dirname (package type is "module").
const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../');

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

    /**
     * webServer: boot all three apps before the test run.
     *
     * - reuseExistingServer: reuse locally (faster iteration), always start fresh in CI.
     * - cwd: repo root so `pnpm --filter` resolves the workspace correctly.
     * - timeout: 120 s — apps need DB connections and env validation on startup.
     * - stdout/stderr piped so boot failures are visible in Playwright output.
     */
    webServer: [
        {
            // API — Hono server, built artifact at apps/api/dist/index.js
            // Rate limiting is disabled in E2E to avoid 429s from parallel
            // test workers all hitting the same localhost IP bucket.
            //
            // reuseExistingServer: true — Playwright never terminates a reused
            // server. The API must be pre-started externally (via wt:up or the
            // CI pipeline) with the correct env (E2E DB URL + rate-limit flags).
            // In CI the pipeline starts the API before invoking Playwright so
            // reuseExistingServer:true is always safe there too.
            command: 'pnpm --filter hospeda-api start',
            url: 'http://localhost:3001/health',
            reuseExistingServer: true,
            cwd: REPO_ROOT,
            timeout: 120_000,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                // Use the E2E database so fixtures and API share the same data.
                HOSPEDA_DATABASE_URL:
                    process.env.HOSPEDA_E2E_DATABASE_URL ??
                    process.env.HOSPEDA_DATABASE_URL ??
                    'postgresql://hospeda_user:hospeda_pass@localhost:5436/hospeda_e2e',
                // Disable all rate-limit tiers. Parallel workers all come from
                // 127.0.0.1 and would fill the auth bucket after a handful of
                // sign-ups otherwise. These flags are read by getRateLimitConfig()
                // on every request (no startup cache), so disabling them here fully
                // disables enforcement regardless of NODE_ENV.
                API_RATE_LIMIT_ENABLED: 'false',
                API_RATE_LIMIT_AUTH_ENABLED: 'false',
                API_RATE_LIMIT_PUBLIC_ENABLED: 'false',
                API_RATE_LIMIT_ADMIN_ENABLED: 'false'
            }
        },
        {
            // Web — Astro SSR preview server, port 4321.
            // reuseExistingServer: true always — Playwright never terminates a
            // server it reused (only ones it started). The CI runner pre-starts
            // the web server before invoking Playwright so this is always safe.
            // In local dev the server is managed by `wt:up` or manually.
            command: 'pnpm --filter hospeda-web preview --port 4321',
            url: WEB_BASE_URL,
            reuseExistingServer: true,
            cwd: REPO_ROOT,
            timeout: 120_000,
            stdout: 'pipe',
            stderr: 'pipe'
        },
        {
            // Admin — TanStack Start server, built artifact at apps/admin/.output/server/index.mjs
            // reuseExistingServer: true always — same rationale as the web server above.
            command: 'pnpm --filter admin start',
            url: 'http://localhost:3000/healthz',
            reuseExistingServer: true,
            cwd: REPO_ROOT,
            timeout: 120_000,
            stdout: 'pipe',
            stderr: 'pipe'
        }
    ],

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
