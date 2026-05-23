/**
 * @file capture-baseline.visual.ts
 * @description SPEC-153 Phase 0 — captures gold-standard visual baselines
 * of the public web app pages at multiple viewports and themes BEFORE
 * migrating to @repo/design-tokens. In Phase 2, the same suite runs again
 * (without --update-snapshots) and pixel-diffs against these baselines.
 *
 * Coverage: 8 pages × 4 viewports × 2 themes = 64 baseline PNGs.
 *
 * Pages skipped intentionally for V1 baseline:
 *  - /es/mi-cuenta/suscripcion/ — auth-gated. Capturing requires a login
 *    fixture (out of scope for SPEC-153). The auth-page surface IS covered
 *    by the public sign-in route indirectly through other layouts.
 *  - Additional /legal/* pages (privacidad, terminos) — same layout family
 *    as cookies; one representative is sufficient for pixel-diff coverage.
 *
 * Theme handling: web's FOUC script reads localStorage.theme on first
 * paint (apps/web/src/components/shared/ThemeFoucScript.astro). We seed
 * localStorage via page.addInitScript BEFORE any document scripts run, so
 * the dark-theme attribute is set in the first frame and no flicker
 * pollutes the snapshot.
 *
 * Dynamic-slug pages (accommodation detail, blog post) use a
 * navigation-first strategy: visit the listing, grab the first card's
 * href, and navigate there. This is resilient to seed-data changes — we
 * never hardcode slugs.
 */

import { type Page, expect, test } from '@playwright/test';

type Theme = 'light' | 'dark';

type PageSpec = {
    readonly key: string;
    readonly path: string;
    readonly navigate?: (page: Page) => Promise<void>;
};

/**
 * Order matters only for snapshot folder layout — tests themselves run
 * independently per (page, theme) combo per project.
 */
const PAGES: ReadonlyArray<PageSpec> = [
    { key: 'home', path: '/es/' },
    { key: 'listing-accommodations', path: '/es/alojamientos/' },
    {
        key: 'detail-accommodation',
        path: '/es/alojamientos/',
        navigate: async (page) => {
            await page.goto('/es/alojamientos/', { waitUntil: 'domcontentloaded' });
            // Match an accommodation detail link, excluding listing/section/filter routes.
            const href = await page
                .locator(
                    'a[href*="/alojamientos/"]:not([href$="/alojamientos/"]):not([href*="/page/"]):not([href*="/mapa"]):not([href*="/caracteristicas/"]):not([href*="/comodidades/"]):not([href*="/tipo/"])'
                )
                .first()
                .getAttribute('href');
            if (!href) throw new Error('No accommodation detail link found on listing');
            await page.goto(href, { waitUntil: 'domcontentloaded' });
        }
    },
    { key: 'publicar', path: '/es/publicar/' },
    { key: 'blog-index', path: '/es/publicaciones/' },
    {
        key: 'blog-post',
        path: '/es/publicaciones/',
        navigate: async (page) => {
            await page.goto('/es/publicaciones/', { waitUntil: 'domcontentloaded' });
            const href = await page
                .locator(
                    'a[href*="/publicaciones/"]:not([href$="/publicaciones/"]):not([href*="/page/"]):not([href*="/autor/"]):not([href*="/categoria/"]):not([href*="/etiqueta/"])'
                )
                .first()
                .getAttribute('href');
            if (!href) throw new Error('No blog post link found on blog index');
            await page.goto(href, { waitUntil: 'domcontentloaded' });
        }
    },
    { key: 'contacto', path: '/es/contacto/' },
    { key: 'legal-cookies', path: '/es/legal/cookies/' }
];

const THEMES: ReadonlyArray<Theme> = ['light', 'dark'];

/**
 * Sets localStorage.theme as the very first thing the page does, so the
 * inline FOUC script applies the right `data-theme` attribute on first
 * paint. Without this, web defaults to light + the dark snapshot would
 * flicker mid-paint.
 */
async function seedTheme(page: Page, theme: Theme): Promise<void> {
    await page.addInitScript((t) => {
        try {
            if (t === 'dark') {
                window.localStorage.setItem('theme', 'dark');
            } else {
                window.localStorage.removeItem('theme');
            }
        } catch {
            // localStorage may be unavailable in some contexts; ignore.
        }
    }, theme);
}

/**
 * Pre-sets the `cookie-consent` cookie so the consent banner mounts silently
 * (CookieConsentBanner.client.tsx renders nothing when getConsent() returns a
 * valid state). The banner is bottom-fixed and localStorage/cookie-dependent;
 * leaving it visible introduces non-deterministic pixels (it occupies a large
 * fraction of mobile viewports). Its own surface is covered by /legal/cookies.
 */
async function seedCookieConsent(page: Page): Promise<void> {
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

/**
 * Hides DOM elements that are non-deterministic across runs and would
 * cause pixel-diff false positives (date-dependent banners, animated
 * decorations, etc.). Keep this list minimal — anything hidden here is
 * NOT covered by the regression gate.
 */
async function hideNonDeterministicElements(page: Page): Promise<void> {
    await page.addStyleTag({
        content: `
            /* Cookie banner: appears only on first visit per session and
               its visibility depends on localStorage state. Hide for
               determinism — it has its own coverage on /legal/cookies. */
            [data-testid="cookie-banner"],
            #cookie-banner,
            .cookie-banner { display: none !important; }

            /* Feedback FAB: a client:idle floating widget (@repo/feedback)
               whose mount timing is non-deterministic — it renders at a
               different idle-load state between runs, polluting the diff
               (the lone 0.22% outlier on contacto/wide-light). Not part of
               the design-token surface under test. */
            [data-testid="feedback-fab"] { display: none !important; }

            /* Disable any scroll-reveal animations that may not have
               settled yet. The animations:disabled flag of
               toHaveScreenshot also covers most of this, but be defensive. */
            * { animation-duration: 0s !important; transition-duration: 0s !important; }
        `
    });
}

/**
 * Wait until fonts are loaded, network is idle, and a small additional
 * delay to let any IntersectionObserver-driven reveals settle.
 */
async function waitForStability(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
        // Some pages keep long-poll connections open; tolerate timeout
        // and rely on fonts + DOM settle instead.
    });
    await page.waitForTimeout(500);
}

for (const spec of PAGES) {
    for (const theme of THEMES) {
        test(`${spec.key} [${theme}]`, async ({ page }, testInfo) => {
            await seedTheme(page, theme);
            await seedCookieConsent(page);

            if (spec.navigate) {
                await spec.navigate(page);
            } else {
                await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
            }

            await hideNonDeterministicElements(page);
            await waitForStability(page);

            // Sanity check: the data-theme attribute must match the requested theme.
            const dataTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );
            if (theme === 'dark' && dataTheme !== 'dark') {
                throw new Error(
                    `[${spec.key}] Expected data-theme=dark, got ${dataTheme ?? 'null'}. localStorage seeding may have failed.`
                );
            }
            if (theme === 'light' && dataTheme === 'dark') {
                throw new Error(`[${spec.key}] Expected light theme, got data-theme=dark.`);
            }

            const projectName = testInfo.project.name;
            // Array form preserves folder hierarchy in snapshotPathTemplate's
            // {arg} placeholder; the string form would sanitize "/" to "-".
            await expect(page).toHaveScreenshot([spec.key, `${projectName}-${theme}.png`], {
                fullPage: true,
                animations: 'disabled',
                caret: 'hide'
            });
        });
    }
}
