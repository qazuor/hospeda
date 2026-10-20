/**
 * GUEST-09 — The old billing's web surfaces are gone (HOS-1352 B13a.9).
 *
 * TEST:B13a:22 — E2E web: the old URLs answer 404, no page links to them, and
 * pricing and "Mi Suscripción" load without calling the old billing client.
 * Covers AC:B13a:20 (add-ons, redeem and plan-change pages removed) and
 * AC:B13a:21 (the old payment and Partner surfaces no longer call the old
 * billing; the Partner pages answer 404 and nothing links to them).
 *
 * Actors: an anonymous visitor (public URLs) and a signed-in USER (the
 * `mi-cuenta` URLs, which redirect an anonymous visitor to sign-in before the
 * router can answer 404).
 * Tags: @p0 @guest @billing
 *
 * ## What "the old client" means here
 *
 * The methods the web's `lib/api` used to expose against the old billing:
 * `/protected/billing/*`, `/public/plans` and `/protected/users/me/subscription`.
 * The browser must not request any of them while pricing or Mi Suscripción
 * loads. `/protected/users/me/entitlements` is NOT in that set on purpose: it is
 * still read by the shared entitlements cache (`lib/entitlements-cache.ts`,
 * through the user menu on every signed-in page), which is outside this leaf —
 * the guard that covers every client fetch is AC:B13a:24 (`B13a.10`).
 *
 * The static twin of the "no link" half is
 * `apps/web/test/static-guards/removed-old-billing-urls.guard.test.ts`.
 */

import { expect, type Page, type Request, test } from '@playwright/test';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** Removed public URLs — answer 404 to anyone. */
const REMOVED_PUBLIC_URLS: readonly string[] = [
    '/es/planes/aliados/',
    '/es/planes/aliados/precios/',
    '/es/partners/checkout/pending/'
];

/** Removed account URLs — answer 404 to a signed-in visitor. */
const REMOVED_ACCOUNT_URLS: readonly string[] = [
    '/es/mi-cuenta/addons/',
    '/es/mi-cuenta/canjear/',
    '/es/mi-cuenta/canjear/PROMO2026/'
];

/** Path fragments no rendered page may link to. */
const REMOVED_PATHS: readonly string[] = [
    '/mi-cuenta/addons',
    '/mi-cuenta/canjear',
    '/partners/checkout',
    '/planes/aliados',
    '/suscriptores/checkout/success',
    '/suscriptores/checkout/failure',
    '/suscriptores/checkout/pending'
];

/** Routes the removed web billing client used to call. */
const OLD_CLIENT_REQUEST =
    /\/api\/v1\/(protected\/billing\/|public\/billing\/|public\/plans(\/|\?|$)|protected\/users\/me\/subscription)/;

/** Pricing surfaces that must load without the old client. */
const PRICING_URLS: readonly string[] = [
    '/es/suscriptores/planes/',
    '/es/planes/anfitriones/precios/',
    '/es/planes/turistas/precios/',
    '/es/planes/gastronomia/precios/',
    '/es/planes/experiencias/precios/'
];

/** Attach a Better-Auth session cookie string to the browser context for the web origin. */
async function attachSession(page: Page, sessionCookie: string): Promise<void> {
    await page.context().addCookies(
        sessionCookie.split('; ').map((c) => {
            const [name, ...rest] = c.split('=');
            return { name: (name ?? '').trim(), value: rest.join('='), url: WEB_URL };
        })
    );
}

/** Every `href` on the current page that names a removed path. */
async function linksToRemovedPaths(page: Page): Promise<readonly string[]> {
    const hrefs = await page
        .locator('a[href]')
        .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    return hrefs.filter((href) => REMOVED_PATHS.some((path) => href.includes(path)));
}

/**
 * Load `url`, collecting every browser request that targets the old client,
 * and return the response status, those requests and the removed-path links.
 */
async function visit(
    page: Page,
    url: string
): Promise<{
    readonly status: number;
    readonly oldClientRequests: readonly string[];
    readonly badLinks: readonly string[];
}> {
    const oldClientRequests: string[] = [];
    const onRequest = (request: Request) => {
        if (OLD_CLIENT_REQUEST.test(request.url())) oldClientRequests.push(request.url());
    };
    page.on('request', onRequest);
    try {
        const response = await page.goto(`${WEB_URL}${url}`, { waitUntil: 'networkidle' });
        const badLinks = await linksToRemovedPaths(page);
        return { status: response?.status() ?? 0, oldClientRequests, badLinks };
    } finally {
        page.off('request', onRequest);
    }
}

test.describe('GUEST-09: the old billing web surfaces are gone @p0 @guest @billing', () => {
    const userIdsToCleanup: string[] = [];

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('TEST:B13a:22 — the removed public URLs answer 404', async ({ request }) => {
        for (const url of REMOVED_PUBLIC_URLS) {
            const response = await request.get(`${WEB_URL}${url}`, { maxRedirects: 0 });
            expect(response.status(), `${url} must answer 404`).toBe(404);
        }
    });

    test('TEST:B13a:22 — pricing loads without the old client and links to no removed page', async ({
        page
    }) => {
        for (const url of PRICING_URLS) {
            const { status, oldClientRequests, badLinks } = await visit(page, url);

            // Positive sibling of the two negatives below: the page really rendered.
            expect(status, `${url} must answer 200`).toBe(200);
            await expect(page.locator('h1').first()).toBeVisible();

            expect(oldClientRequests, `${url} called the old billing client`).toEqual([]);
            expect(badLinks, `${url} links to a removed page`).toEqual([]);
        }
    });

    test('TEST:B13a:22 — a signed-in visitor gets 404 on the removed account URLs, and Mi Suscripción loads clean', async ({
        page
    }) => {
        // ── Arrange ────────────────────────────────────────────────────────
        const user = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(user.id);
        await markProfileCompleted({ userId: user.id });
        await attachSession(page, user.sessionCookie);

        // ── Act + Assert: the removed account pages are 404 ─────────────────
        for (const url of REMOVED_ACCOUNT_URLS) {
            const response = await page.request.get(`${WEB_URL}${url}`, { maxRedirects: 0 });
            expect(response.status(), `${url} must answer 404`).toBe(404);
        }

        // ── Act + Assert: Mi Suscripción and the account home ───────────────
        for (const url of ['/es/mi-cuenta/suscripcion/', '/es/mi-cuenta/']) {
            const { status, oldClientRequests, badLinks } = await visit(page, url);

            expect(status, `${url} must answer 200`).toBe(200);
            // Not bounced to sign-in or to a profile gate: the session reached the page.
            expect(page.url()).toContain(url);
            expect(oldClientRequests, `${url} called the old billing client`).toEqual([]);
            expect(badLinks, `${url} links to a removed page`).toEqual([]);
        }
    });
});
