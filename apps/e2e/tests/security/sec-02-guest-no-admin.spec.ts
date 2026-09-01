/**
 * SEC-02 — Common guest cannot reach admin surfaces.
 *
 * Actors: Authenticated guest (role=USER, no privileged permission).
 * Tags: @p0 @security
 *
 * Validates that:
 *   - Admin app rejects USER-role sessions and either redirects to login
 *     or renders a forbidden page.
 *   - Admin API endpoints reject the same session with 403.
 *
 * @see SPEC-092 spec.md § SEC-02
 */

import { expect, test } from '@playwright/test';
import { createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('SEC-02: guest cannot reach admin @p0 @security', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
            userId = null;
        }
    });

    test('USER-role session blocked from admin app + admin API endpoints', async ({ page }) => {
        // ── Setup: a plain USER (no host promotion) ────────────────────────
        const guest = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        await forceVerifyEmail(guest.id);
        userId = guest.id;

        await page.context().addCookies(
            guest.sessionCookie.split('; ').map((c) => {
                const [name, ...rest] = c.split('=');
                return { name: (name ?? '').trim(), value: rest.join('='), url: ADMIN_URL };
            })
        );

        // ── 1. Open admin root → redirected out, to the web access-denied page ──
        //
        // HOS-609 made this outcome single and deterministic, which is what lets
        // the assertion below name ONE destination instead of accepting a list.
        // Every authenticated visitor without ACCESS_PANEL_ADMIN now leaves for
        // {web}/{locale}/acceso-denegado/, whatever their roles — the old split
        // (a plain USER to the /publicar host funnel, a HOST to the admin's own
        // /auth/forbidden) is gone.
        //
        // The guard runs SERVER-side in `_authed`'s beforeLoad (a createServerFn),
        // so the redirect arrives as a real 3xx before any HTML: there is no
        // React-effect guard anywhere in this chain and therefore no window in
        // which the browser holds an admin URL. Playwright follows the chain and
        // reports the final response, so `page.url()` settles without a wait.
        const adminResponse = await page.goto(`${ADMIN_URL}/`, {
            waitUntil: 'domcontentloaded'
        });
        const finalUrl = page.url();
        const status = adminResponse?.status() ?? 200;

        // Two conditions, both required — an AND, not the OR-chain this used to
        // be. That chain accepted `/dashboard`, the admin panel itself: the one
        // place a blocked user must never end up. It also tested
        // `/auth/sign-in`, which never matched anything, because the route is
        // spelled `/auth/signin`. Between those two the check could not fail
        // for any URL the admin could realistically serve.
        expect(
            finalUrl,
            `expected the admin to redirect a USER-role session out to the web access-denied page, got status=${status} url=${finalUrl}`
        ).toContain('/acceso-denegado');
        expect(
            finalUrl.startsWith(ADMIN_URL),
            `expected the final URL to be outside the admin origin (${ADMIN_URL}), got ${finalUrl}`
        ).toBe(false);

        // ── 2. Each admin API endpoint → 403 ───────────────────────────────
        const adminEndpoints = [
            '/api/v1/admin/accommodations',
            '/api/v1/admin/users',
            '/api/v1/admin/billing/plans'
        ];
        for (const endpoint of adminEndpoints) {
            const response = await page.request.get(`${API_URL}${endpoint}`, {
                headers: { cookie: guest.sessionCookie }
            });
            expect(
                [401, 403].includes(response.status()),
                `${endpoint} expected 401/403 for USER, got ${response.status()}`
            ).toBe(true);
        }
    });
});
