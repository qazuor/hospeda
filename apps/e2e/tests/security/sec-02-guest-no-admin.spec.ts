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

        // ── 1. Open admin root → redirect to login or forbidden ────────────
        const adminResponse = await page.goto(`${ADMIN_URL}/`, {
            waitUntil: 'domcontentloaded'
        });
        const finalUrl = page.url();
        const status = adminResponse?.status() ?? 200;
        expect(
            status >= 400 ||
                finalUrl.includes('/auth/sign-in') ||
                finalUrl.includes('/auth/forbidden') ||
                finalUrl.includes('/forbidden'),
            `expected redirect or 4xx, got status=${status} url=${finalUrl}`
        ).toBe(true);

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
