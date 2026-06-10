/**
 * @file capture-baseline.visual.ts
 * @description SPEC-153 T-153-32 — Captures REFERENCE visual snapshots of
 * the authenticated admin after its migration to @repo/design-tokens
 * (river brand, Geologica/Roboto, light + dark). These are a starting
 * point for future admin visual work (e.g. SPEC-155 dashboards), NOT a
 * regression gate — the threshold in playwright-visual.config.ts is
 * intentionally loose.
 *
 * Auth: the `setup` project (auth.setup.ts) logs in and saves storageState,
 * which this project reuses (configured via `dependencies` + `storageState`).
 *
 * Dark mode: admin has no DOM theme-application layer yet (the themeAdmin
 * preference isn't wired to <html>), so we set `data-theme="dark"` directly
 * after load — the [data-app="admin"][data-theme="dark"] token scope and the
 * color-mix surfaces then flip.
 *
 * Coverage: key authed pages × 4 viewports × 2 themes.
 */

import { type Page, expect, test } from '@playwright/test';

type Theme = 'light' | 'dark';

type PageSpec = {
    readonly key: string;
    readonly path: string;
};

const PAGES: ReadonlyArray<PageSpec> = [
    { key: 'dashboard', path: '/dashboard' },
    { key: 'accommodations-list', path: '/accommodations' },
    { key: 'settings', path: '/account/preferences' }
];

const THEMES: ReadonlyArray<Theme> = ['light', 'dark'];

async function applyTheme(page: Page, theme: Theme): Promise<void> {
    await page.evaluate((t) => {
        if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
    }, theme);
}

async function hideNonDeterministic(page: Page): Promise<void> {
    await page.addStyleTag({
        content: `
            /* Feedback FAB: client:idle floating widget, non-deterministic mount. */
            [data-testid="feedback-fab"] { display: none !important; }
            * { animation-duration: 0s !important; transition-duration: 0s !important; }
        `
    });
}

async function waitForStability(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
        // tolerate long-poll connections
    });
    await page.waitForTimeout(500);
}

for (const spec of PAGES) {
    for (const theme of THEMES) {
        test(`${spec.key} [${theme}]`, async ({ page }, testInfo) => {
            await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
            await applyTheme(page, theme);
            await hideNonDeterministic(page);
            await waitForStability(page);

            const projectName = testInfo.project.name;
            await expect(page).toHaveScreenshot([spec.key, `${projectName}-${theme}.png`], {
                fullPage: true,
                animations: 'disabled',
                caret: 'hide'
            });
        });
    }
}
