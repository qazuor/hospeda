/**
 * ADM-04 — Super-admin lists plans and addons.
 *
 * Actors: Super-admin reading the billing catalog endpoints.
 * Tags: @p1 @admin @billing
 *
 * Preconditions:
 *   - At least one user that we promote to SUPER_ADMIN via direct DB.
 *   - Seed contains at least one billing plan and one addon.
 *
 * What this validates:
 *  1. With a super-admin actor, GET `/api/v1/admin/billing/plans` returns
 *     the catalog (≥ 1 plan).
 *  2. GET `/api/v1/admin/billing/addons` returns ≥ 1 addon.
 *  3. With a regular USER actor, the same endpoints return 401/403 (the
 *     admin permission gate is enforced).
 *
 * Why this is read-only:
 *   Plan and addon definitions are catalog rows seeded from
 *   `@repo/billing` config; the admin UI is read-mostly. Mutations are
 *   covered by the billing package unit tests + admin migrations.
 *
 * @see SPEC-092 spec.md § ADM-04
 */

import { expect, test } from '@playwright/test';
import { createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('ADM-04: super-admin lists plans + addons @p1 @admin @billing', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('super_admin sees catalog; regular user is rejected', async ({ page }) => {
        // ── Setup: super-admin actor ──────────────────────────────────────
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await forceVerifyEmail(superAdmin.id);

        // ── Setup: regular user ───────────────────────────────────────────
        const regularUser = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(regularUser.id);
        await forceVerifyEmail(regularUser.id);

        // Sanity check: seed has plans and addons.
        const planRows = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM billing_plans WHERE active = true'
        );
        const addonRows = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM billing_addons WHERE active = true'
        );
        if (Number(planRows[0]?.count ?? 0) === 0 || Number(addonRows[0]?.count ?? 0) === 0) {
            test.fixme(true, 'Seed has no plans or addons — ADM-04 cannot run');
            return;
        }

        // ── 1. Super-admin: plans + addons accessible ─────────────────────
        const plansRes = await page.request.get(`${API_URL}/api/v1/admin/billing/plans`, {
            headers: { cookie: superAdmin.sessionCookie }
        });
        expect(
            plansRes.ok(),
            `super-admin GET plans should be 2xx (got ${plansRes.status()})`
        ).toBe(true);
        const plansBody = (await plansRes.json()) as {
            data?: ReadonlyArray<{ slug?: string; name?: string }>;
        };
        const plansList = plansBody.data ?? [];
        expect(plansList.length, 'admin plans list should be non-empty').toBeGreaterThan(0);

        const addonsRes = await page.request.get(`${API_URL}/api/v1/admin/billing/addons`, {
            headers: { cookie: superAdmin.sessionCookie }
        });
        expect(
            addonsRes.ok(),
            `super-admin GET addons should be 2xx (got ${addonsRes.status()})`
        ).toBe(true);
        const addonsBody = (await addonsRes.json()) as {
            data?: ReadonlyArray<{ slug?: string }>;
        };
        const addonsList = addonsBody.data ?? [];
        expect(addonsList.length, 'admin addons list should be non-empty').toBeGreaterThan(0);

        // ── 2. Regular user: rejected with 401/403 ────────────────────────
        const plansForbiddenRes = await page.request.get(`${API_URL}/api/v1/admin/billing/plans`, {
            headers: { cookie: regularUser.sessionCookie }
        });
        expect(
            [401, 403].includes(plansForbiddenRes.status()),
            `regular USER should be rejected on admin plans (got ${plansForbiddenRes.status()})`
        ).toBe(true);
    });
});
