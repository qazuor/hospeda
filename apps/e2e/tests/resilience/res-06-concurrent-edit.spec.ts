/**
 * RES-06 — Concurrent edit on the same accommodation: last-write-wins.
 *
 * Actors: Same host running two PATCH calls in parallel against one
 *         accommodation row.
 * Tags: @p0 @resilience @accommodation @cross-app
 *
 * Preconditions:
 *   - Host with active subscription.
 *   - Published accommodation owned by the host.
 *
 * What this validates:
 *  1. Two PATCH calls dispatched in parallel both return 2xx (no 409
 *     conflict — Hospeda's documented contract is last-write-wins).
 *  2. The DB row ends with EXACTLY ONE of the two new values
 *     (not a corrupted merge, not the original).
 *  3. The contract holds even though the writes interleave: the system
 *     does not partially apply one write and then partially apply the
 *     other.
 *
 * Why we accept last-write-wins explicitly:
 *   - SPEC-092 spec.md § RES-06 documents this as the chosen semantics.
 *   - Optimistic-locking with version numbers is post-beta scope.
 *   - The test's job is to ensure the behavior is *deterministic and
 *     non-corrupting*, not to prefer one writer over the other.
 *
 * @see SPEC-092 spec.md § RES-06
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

test.describe('RES-06: concurrent edit last-write-wins @p0 @resilience @accommodation', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('two parallel PATCHes both 2xx; final row matches exactly one write', async ({ page }) => {
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — RES-06 cannot run');
            return;
        }
        await createSubscription({ userId: host.id, planId, status: 'active' });

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'res-06'
        });

        const nameA = `Concurrent A ${Date.now()}`;
        const nameB = `Concurrent B ${Date.now()}`;

        // ── Dispatch both PATCHes in parallel ──────────────────────────────
        const [resA, resB] = await Promise.all([
            page.request.patch(`${API_URL}/api/v1/protected/accommodations/${accommodation.id}`, {
                data: { name: nameA },
                headers: { cookie: host.sessionCookie }
            }),
            page.request.patch(`${API_URL}/api/v1/protected/accommodations/${accommodation.id}`, {
                data: { name: nameB },
                headers: { cookie: host.sessionCookie }
            })
        ]);

        expect(resA.ok(), `first concurrent PATCH should succeed (got ${resA.status()})`).toBe(
            true
        );
        expect(resB.ok(), `second concurrent PATCH should succeed (got ${resB.status()})`).toBe(
            true
        );

        // ── DB invariant: exactly one of the two values won ───────────────
        const rows = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        const finalName = rows[0]?.name ?? '';
        expect(
            finalName === nameA || finalName === nameB,
            `final row name must equal one of the two writes (got "${finalName}")`
        ).toBe(true);
    });
});
