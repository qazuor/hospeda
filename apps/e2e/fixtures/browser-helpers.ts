import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Wait until the Astro island that contains `locator` has hydrated.
 *
 * Page islands wait for the web app's i18n hydration gate (DOMContentLoaded,
 * HOS-2572), so their server-rendered controls are visible before React owns
 * them: a `fill` before hydration is dropped from the form state and a click
 * does nothing. Astro removes the island's `ssr` attribute once it hydrates;
 * this polls the CLOSEST island (not an outer one) for that.
 *
 * @param params.locator - Any element inside the island (e.g. its first input).
 * @param params.timeout - Milliseconds to wait (default 15s).
 */
export async function waitForIslandHydration({
    locator,
    timeout = 15_000
}: {
    readonly locator: Locator;
    readonly timeout?: number;
}): Promise<void> {
    await expect
        .poll(
            () =>
                locator.evaluate((el) => {
                    const island = el.closest('astro-island');
                    return island !== null && !island.hasAttribute('ssr');
                }),
            { message: 'The island around this element never hydrated.', timeout }
        )
        .toBe(true);
}

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
 * This approach mirrors the pattern used in
 * `apps/web/tests/visual-snapshots/capture-baseline.visual.ts` (lines 112-128)
 * and intentionally avoids introducing a custom `test.extend` base fixture or
 * any flag in app source.
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
