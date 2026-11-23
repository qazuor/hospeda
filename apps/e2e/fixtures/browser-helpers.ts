import type { Page } from '@playwright/test';

/**
 * Pre-seed the cookie-consent cookie so the web banner never opens during e2e.
 *
 * The web app checks `document.cookie` for the `cookie-consent` key on every
 * page load. If the key is absent (fresh browser context), the bottom-fixed
 * consent banner renders and can overlay or shift page content, causing
 * selector misses, pixel diffs, and non-deterministic navigation behaviour in
 * tests.
 *
 * `page.addInitScript` fires before any navigation in the browser context, so
 * calling this in a `test.beforeEach` registers the cookie for every page the
 * test visits, including initial loads and client-side transitions.
 *
 * This approach intentionally avoids introducing a custom `test.extend` base
 * fixture or any flag in app source. The visual-regression specs
 * (`tests/visual/`) rely on it too: a consent banner in a baseline would be a
 * diff on every page.
 *
 * Cookie shape (version 2):
 *   { necessary: true, crashReporting: false, analytics: false,
 *     marketing: false, version: 2, decidedAt: '2026-01-01T00:00:00.000Z' }
 *
 * @param page - The Playwright `Page` instance from the current test.
 */
export async function seedCookieConsent(page: Page): Promise<void> {
    const consent = JSON.stringify({
        necessary: true,
        crashReporting: false,
        analytics: false,
        marketing: false,
        version: 2,
        decidedAt: '2026-01-01T00:00:00.000Z'
    });
    await page.addInitScript((value) => {
        try {
            document.cookie = `cookie-consent=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
        } catch {
            // document.cookie may be unavailable in some contexts; ignore.
        }
    }, consent);
}
