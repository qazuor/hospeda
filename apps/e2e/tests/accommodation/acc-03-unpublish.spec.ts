/**
 * ACC-03 — Host unpublishes; accommodation disappears from public surfaces.
 *
 * Actors: Host (owner) + Guest (anonymous reader through public API).
 * Tags: @p0 @accommodation @cross-app
 *
 * Preconditions:
 *   - Host with an active paid subscription (so writes are allowed).
 *   - One accommodation owned by the host in `lifecycleState='ACTIVE'` and
 *     `visibility='PUBLIC'`.
 *
 * What this validates:
 *  1. Before unpublish: public GET by id responds with the accommodation data.
 *  2. After unpublish (lifecycle_state → DRAFT): public GET by id returns
 *     null/404 — anonymous readers cannot see DRAFT content.
 *  3. After unpublish: public list/search does not include the accommodation.
 *  4. DB invariant: the row was modified, not deleted.
 *
 * @see SPEC-092 spec.md § ACC-03
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

test.describe('ACC-03: host unpublishes — accommodation disappears @p0 @accommodation @cross-app', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('publish → public GET 200 → unpublish → public GET 404/null', async ({ page }) => {
        // ── Setup: paid host + published accommodation ─────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — ACC-03 cannot run');
            return;
        }

        await createSubscription({
            userId: host.id,
            planId,
            status: 'active'
        });

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'acc-03'
        });

        // ── 1. Before unpublish: public GET succeeds ───────────────────────
        const beforeRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${accommodation.id}`
        );
        expect(
            beforeRes.ok(),
            `expected public GET 200 before unpublish, got ${beforeRes.status()}`
        ).toBe(true);
        const beforeBody = (await beforeRes.json()) as { data?: { id: string } | null };
        expect(beforeBody.data?.id).toBe(accommodation.id);

        // ── 2. Unpublish: PATCH lifecycle_state to DRAFT ───────────────────
        // We update via SQL because the protected/admin patch endpoints have
        // a wider validation surface; ACC-03 validates the public-visibility
        // contract, not the publish/unpublish UI flow (covered by HOST-01).
        await execSQL(
            `UPDATE accommodations
             SET lifecycle_state = 'DRAFT',
                 updated_at = NOW()
             WHERE id = $1`,
            [accommodation.id]
        );

        // ── 3. After unpublish: public GET returns null or 404 ─────────────
        const afterRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${accommodation.id}`
        );
        if (afterRes.status() === 404) {
            // 404 is an acceptable contract for non-public content.
        } else {
            expect(afterRes.ok(), `expected null body or 404, got ${afterRes.status()}`).toBe(true);
            const afterBody = (await afterRes.json()) as { data?: { id: string } | null };
            expect(
                afterBody.data,
                `expected data=null after unpublish (got ${JSON.stringify(afterBody.data)})`
            ).toBeNull();
        }

        // ── 4. Public listing does not include the accommodation ──────────
        // Sort by created_at DESC so the just-unpublished item would be at the
        // top of page 1 if it were still public — asserting its ABSENCE here
        // is therefore deterministic (not buried on page 2+).
        const listRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations?pageSize=100&sortBy=createdAt&sortOrder=desc`
        );
        expect(listRes.ok(), `public listing should be 200, got ${listRes.status()}`).toBe(true);
        const listBody = (await listRes.json()) as {
            data?: { items?: ReadonlyArray<{ id: string }> };
        };
        const ids = listBody.data?.items?.map((row) => row.id) ?? [];
        expect(ids).not.toContain(accommodation.id);

        // ── 5. DB invariant: row exists, lifecycle is DRAFT, not deleted ──
        const rows = await execSQL<{ lifecycle_state: string; deleted_at: string | null }>(
            'SELECT lifecycle_state, deleted_at FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(rows[0]?.lifecycle_state).toBe('DRAFT');
        expect(rows[0]?.deleted_at).toBeNull();
    });
});
