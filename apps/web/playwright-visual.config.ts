/**
 * @file playwright-visual.config.ts
 * @description Playwright config for visual regression snapshots used by
 * SPEC-153 (Admin Design Tokens). Distinct from any future functional e2e
 * config under apps/e2e — this one ONLY captures and diffs PNGs of the web
 * app at multiple viewports and themes.
 *
 * Phase 0 (this config + capture-baseline.ts) records gold-standard
 * baselines BEFORE migrating web to consume @repo/design-tokens. Phase 2
 * re-runs the same suite and pixel-diffs against the baselines. Acceptance:
 * 0 pixel diff (allowing only known font-rendering noise <0.1%).
 *
 * Projects are viewports only (mobile/tablet/desktop/wide). Theme variants
 * (light/dark) are handled by the capture script via setting
 * `localStorage.theme` + reload per snapshot, so the matrix lives in one
 * place (the test code) instead of being split between config and test.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.VISUAL_TEST_BASE_URL ?? 'http://localhost:4322';

/**
 * Where rendered snapshots land. Phase 0 + Phase 2 use distinct dirs so the
 * pre-migration `baseline/` set can be diffed against a post-migration
 * `actual/` set by T-153-23. Default stays `baseline` for back-compat with
 * the Phase 0 capture invocation.
 */
const SNAPSHOT_DIR = process.env.VISUAL_TEST_SNAPSHOT_DIR ?? 'baseline';

/**
 * Viewport matrix. Heights chosen to capture full hero + at least one
 * below-fold section on each device class. Snapshots use `fullPage: true`
 * so heights are upper bounds only.
 */
const VIEWPORTS = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 },
    wide: { width: 1920, height: 1080 }
} as const;

export default defineConfig({
    testDir: './tests/visual-snapshots',
    testMatch: /.*\.visual\.ts$/,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-visual-report' }]],

    snapshotPathTemplate: `tests/visual-snapshots/${SNAPSHOT_DIR}/{arg}{ext}`,

    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.001,
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

    // All projects pin to Chromium intentionally — mixing engines (e.g.
    // WebKit for iPad device emulation) introduces font/AA rendering
    // differences that would inflate the pixel-diff noise floor and
    // defeat the purpose of the regression gate.
    projects: [
        {
            name: 'mobile',
            use: { ...devices['Pixel 7'], viewport: VIEWPORTS.mobile }
        },
        {
            name: 'tablet',
            use: {
                browserName: 'chromium',
                viewport: VIEWPORTS.tablet,
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: true
            }
        },
        {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop }
        },
        {
            name: 'wide',
            use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.wide }
        }
    ],

    webServer: process.env.VISUAL_TEST_NO_WEBSERVER
        ? undefined
        : {
              // Run on a dedicated port to avoid collision with any
              // long-running `pnpm dev` already on the default 4321.
              command: 'pnpm exec astro dev --port 4322',
              url: BASE_URL,
              reuseExistingServer: true,
              stdout: 'ignore',
              stderr: 'pipe',
              timeout: 180_000
          }
});
