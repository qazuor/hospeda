import { type BrowserContext, expect, type Page } from '@playwright/test';
import { signInExistingUser } from './api-helpers.ts';
import { seedCookieConsent } from './browser-helpers.ts';
import { execSQL } from './db-helpers.ts';

/**
 * Shared setup for the Mi Cuenta visual-regression specs (HOS-2471).
 *
 * Every spec under `tests/visual/` shoots the same matrix: light and dark ×
 * desktop 1280 and mobile 375 (HOS-2413 §6.11). These helpers keep the matrix,
 * the sign-in and the "page is settled" wait in one place, so two specs can
 * never disagree on what a stable screenshot means.
 */

/** Web base URL (dedicated E2E port, `.env.e2e` SSOT). */
export const VISUAL_WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

/** API base URL (dedicated E2E port, `.env.e2e` SSOT). */
export const VISUAL_API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

/** The two themes the site ships (`localStorage.theme`, `ThemeFoucScript.astro`). */
export const VISUAL_THEMES = ['light', 'dark'] as const;

/** One theme of {@link VISUAL_THEMES}. */
export type VisualTheme = (typeof VISUAL_THEMES)[number];

/** The two viewports of the matrix: the desktop shell and the mobile AccountBar. */
export const VISUAL_VIEWPORTS = {
    desktop: { width: 1280, height: 800 },
    mobile: { width: 375, height: 812 }
} as const;

/** One viewport name of {@link VISUAL_VIEWPORTS}. */
export type VisualViewport = keyof typeof VISUAL_VIEWPORTS;

/** Every (theme, viewport) pair, in a stable order. */
export const VISUAL_MATRIX: ReadonlyArray<{
    readonly theme: VisualTheme;
    readonly viewport: VisualViewport;
}> = VISUAL_THEMES.flatMap((theme) =>
    (Object.keys(VISUAL_VIEWPORTS) as VisualViewport[]).map((viewport) => ({ theme, viewport }))
);

/**
 * The seeded account the visual specs sign in as: a plain tourist (role USER)
 * seeded by `packages/seed/src/example/venues.seed.ts`. Other specs only READ
 * it (listing-owner-02/04), so its dashboard is the same on every run.
 */
export const VISUAL_USER = {
    email: 'e2e-tourist@local.test',
    password: 'Password123!'
} as const;

/**
 * Web welcome tours that auto-start on the dashboard
 * (`apps/web/src/config/tours.ts`, `page: 'dashboard'`). Their driver.js
 * overlay covers the whole page, so a dashboard baseline taken with one armed
 * is a screenshot of the tour, not of the shell.
 */
const DASHBOARD_WELCOME_TOUR_IDS = ['web.tourist.welcome', 'web.host.welcome'] as const;

/** Seen-version far above any real tour version, so a tour bump never re-arms it. */
const TOUR_SEEN_VERSION = 9999;

/**
 * Marks the dashboard welcome tours as seen for a user, merging into
 * `settings.onboarding.adminTours` (the map `/users/me/tour-progress` reads for
 * web and admin alike) without touching any other setting. Idempotent.
 *
 * What's New needs nothing: its baseline is written lazily on the first read,
 * so a seeded account never has an unseen highlight.
 *
 * @param input.email - The user's email.
 * @returns The user's id.
 * @throws When the user does not exist or the write did not land.
 */
async function markWebWelcomeToursSeen(input: {
    readonly email: string;
}): Promise<{ readonly userId: string }> {
    const seen = Object.fromEntries(
        DASHBOARD_WELCOME_TOUR_IDS.map((id) => [id, TOUR_SEEN_VERSION])
    );
    const rows = await execSQL<{ id: string; tours: Record<string, number> | null }>(
        `UPDATE users
            SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
                    'onboarding',
                    COALESCE(settings -> 'onboarding', '{}'::jsonb) || jsonb_build_object(
                        'adminTours',
                        COALESCE(settings -> 'onboarding' -> 'adminTours', '{}'::jsonb) || $2::jsonb
                    )
                )
          WHERE email = $1
      RETURNING id, settings -> 'onboarding' -> 'adminTours' AS tours`,
        [input.email, JSON.stringify(seen)]
    );
    const row = rows[0];
    for (const id of DASHBOARD_WELCOME_TOUR_IDS) {
        if (row?.tours?.[id] !== TOUR_SEEN_VERSION) {
            throw new Error(
                `markWebWelcomeToursSeen: '${id}' is not marked seen for ${input.email} after the write.`
            );
        }
    }
    return { userId: row?.id ?? '' };
}

/**
 * Prepares a page for a deterministic screenshot: signs in as
 * {@link VISUAL_USER}, sizes the viewport, seeds the cookie consent (no
 * banner) and pins the theme BEFORE the first paint through the same
 * `localStorage.theme` key `ThemeFoucScript.astro` reads.
 *
 * The first signed-in page of a session applies the profile's saved theme
 * once (`syncSavedThemeChoice` in `apps/web/src/lib/theme.ts`), and the
 * profile answers `system` for an account that never chose: measured, it
 * flipped a dark run back to light mid-test. So the session's theme-sync
 * marker (`sessionStorage.themeSyncedFor = <userId>`) is stamped before the
 * first paint too — the same state a user who just picked a theme has — and
 * {@link settleVisualPage} still asserts the attribute.
 *
 * @param input.page - The test page.
 * @param input.context - Its browser context (receives the session cookies).
 * @param input.theme - Theme to render.
 * @param input.viewport - Viewport to render at.
 * @returns Nothing; the page is ready for `goto`.
 */
export async function prepareVisualPage(input: {
    readonly page: Page;
    readonly context: BrowserContext;
    readonly theme: VisualTheme;
    readonly viewport: VisualViewport;
}): Promise<void> {
    const { page, context, theme, viewport } = input;
    const { userId } = await markWebWelcomeToursSeen({ email: VISUAL_USER.email });
    const sessionCookie = await signInExistingUser(
        { email: VISUAL_USER.email, password: VISUAL_USER.password },
        { apiBaseUrl: VISUAL_API_URL, webBaseUrl: VISUAL_WEB_URL }
    );
    await context.addCookies(
        sessionCookie.split('; ').map((part) => {
            const eqIdx = part.indexOf('=');
            return {
                name: eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim(),
                value: eqIdx === -1 ? '' : part.slice(eqIdx + 1),
                url: VISUAL_WEB_URL
            };
        })
    );
    await page.setViewportSize(VISUAL_VIEWPORTS[viewport]);
    await seedCookieConsent(page);
    await page.addInitScript(
        (value) => {
            try {
                localStorage.setItem('theme', value.theme);
                sessionStorage.setItem('themeSyncedFor', value.userId);
            } catch {
                // Storage unavailable: the theme assertion in settleVisualPage fails loudly.
            }
        },
        { theme, userId }
    );
}

/**
 * Navigates and waits until the page can no longer change by itself: the
 * network is idle, every eager (`load`/`idle`) Astro island has hydrated (Astro drops the `ssr`
 * attribute once it does), web fonts have loaded, and the theme attribute is
 * the one under test. Asserting the theme is what stops a dark baseline from
 * silently being a light one.
 *
 * @param input.page - The prepared page.
 * @param input.path - Path to open (e.g. `/es/mi-cuenta/`).
 * @param input.theme - Theme the page must be showing.
 * @returns The HTTP status of the navigation.
 */
export async function settleVisualPage(input: {
    readonly page: Page;
    readonly path: string;
    readonly theme: VisualTheme;
}): Promise<number> {
    const { page, path, theme } = input;
    const response = await page.goto(`${VISUAL_WEB_URL}${path}`, { waitUntil: 'networkidle' });
    // Only eager islands: `client:media` islands for the other breakpoint and
    // `client:visible` islands off-screen legitimately never hydrate.
    await page.waitForFunction(
        () =>
            document.querySelectorAll(
                'astro-island[ssr][client="load"], astro-island[ssr][client="idle"]'
            ).length === 0,
        null,
        { timeout: 15_000 }
    );
    await page.evaluate(async () => {
        await document.fonts.ready;
    });
    if (theme === 'dark') {
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    } else {
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    }
    return response?.status() ?? 0;
}

/**
 * Turns a `data-visual` name (`<Component>/<state>`) into a file-safe
 * screenshot name segment.
 *
 * @param input.name - The `data-visual` value.
 * @returns The name with every character outside `[A-Za-z0-9-]` replaced by `-`.
 */
export function visualFileSegment(input: { readonly name: string }): string {
    return input.name.replace(/[^A-Za-z0-9-]+/g, '-');
}
