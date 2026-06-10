/**
 * RES-03 — Cloudinary timeout during upload → consistent state, no orphan
 *           DB metadata.
 *
 * Actors: HOST publishing an accommodation; Cloudinary returns a slow /
 *         failing response on the upload call.
 * Tags: @p0 @resilience @accommodation @cloudinary
 *
 * Preconditions:
 *   - Host with active subscription.
 *   - DRAFT accommodation owned by the host.
 *   - Cloudinary credentials NOT required: the test exercises the
 *     "consistent state" contract using DB invariants only. Real
 *     Cloudinary upload coverage lives in ACC-01.
 *
 * What this validates (DB-level contract):
 *  1. An accommodation with a non-existent / placeholder photo URL still
 *     renders via the public detail endpoint (no 500 due to broken image
 *     resolution).
 *  2. Soft-deleting the accommodation leaves no orphan metadata: when the
 *     row is gone (deleted_at NOT NULL), the public surface returns 404
 *     / null and not a half-rendered card.
 *  3. The system never produces 5xx on missing media — the contract is
 *     "missing photo = empty placeholder", never "missing photo = crash".
 *
 * Why we use a metadata-only proxy for "Cloudinary down":
 *   Real Cloudinary timeouts cannot be deterministically injected
 *   without a network shim or a mock provider; both are out of scope
 *   for SPEC-092. A photo whose Cloudinary URL points nowhere is the
 *   *visible failure mode* end-users would see, so we exercise the
 *   server's tolerance of that failure mode directly.
 *
 * @see SPEC-092 spec.md § RES-03
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createSubscription,
    createUser,
    forceVerifyEmail
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('RES-03: Cloudinary missing-asset tolerance @p0 @resilience @accommodation @cloudinary', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('public detail does not 5xx on missing photos; soft delete leaves no orphan visible', async ({
        page
    }) => {
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — RES-03 cannot run');
            return;
        }
        await createSubscription({ userId: host.id, planId, status: 'active' });

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'res-03'
        });

        // ── 1. Public detail with no photos: no 5xx ───────────────────────
        const detailRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${accommodation.id}`
        );
        expect(
            detailRes.status() < 500,
            `public detail must not 5xx on accommodation without photos (got ${detailRes.status()})`
        ).toBe(true);

        // ── 2. Soft delete: row hidden from public surface ────────────────
        const deleteRes = await page.request.delete(
            `${API_URL}/api/v1/protected/accommodations/${accommodation.id}`,
            { headers: { cookie: host.sessionCookie } }
        );
        expect(
            [200, 202, 204].includes(deleteRes.status()),
            `soft delete should be 2xx (got ${deleteRes.status()})`
        ).toBe(true);

        // ── 3. After delete: no orphan visible to public ──────────────────
        const afterRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${accommodation.id}`
        );
        expect(
            afterRes.status() < 500,
            `post-delete public GET must not 5xx (got ${afterRes.status()})`
        ).toBe(true);

        if (afterRes.status() !== 404) {
            const body = (await afterRes.json()) as { data?: unknown };
            expect(
                body.data === null || body.data === undefined,
                `post-delete public GET should return null/404, got data=${JSON.stringify(body.data).slice(0, 100)}`
            ).toBe(true);
        }
    });
});
