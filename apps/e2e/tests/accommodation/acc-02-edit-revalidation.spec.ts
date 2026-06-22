/**
 * ACC-02 — Host edit propagates via real revalidation.
 *
 * Actors: Host (owner) editing an active accommodation.
 * Tags: @p0 @accommodation @cache @cross-app
 *
 * Preconditions:
 *   - Host with active subscription.
 *   - Published accommodation owned by the host.
 *   - RevalidationService writes to `revalidation_log` (SPEC-034 audit table).
 *
 * What this validates:
 *  1. Capturing a `since` checkpoint before the edit gives the assertion a
 *     bounded search window into `revalidation_log`.
 *  2. PATCH-ing the accommodation as the owner updates the row.
 *  3. The revalidation hook fires and writes at least one entry into
 *     `revalidation_log` for the accommodation entity within a small
 *     timeout (5s default).
 *  4. DB invariant: the new value is persisted.
 *
 * Why we don't measure ISR cache TTL directly:
 *  - SPEC-092 spec.md § ACC-02 explicitly chooses spying on
 *    RevalidationService over wall-clock cache observation, because timing
 *    is non-deterministic. The contract that matters is "the system
 *    scheduled a revalidation"; the adapter handles the rest.
 *
 * @see SPEC-092 spec.md § ACC-02
 * @see apps/e2e/fixtures/revalidation-spy.ts
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createSubscription,
    createUser,
    forceVerifyEmail
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    assertRevalidationTriggered,
    captureRevalidationCheckpoint
} from '../../fixtures/revalidation-spy.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('ACC-02: edit propagates via revalidation @p0 @accommodation @cache @cross-app', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('host edits accommodation → revalidation_log gets entry for entity', async ({ page }) => {
        // ── Setup: paid host + published accommodation ─────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — ACC-02 cannot run');
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
            slugPrefix: 'acc-02'
        });

        // Capture the floor for the audit-log search BEFORE the edit fires.
        const since = captureRevalidationCheckpoint();

        // ── Edit: PATCH name (a simple, always-valid field) ───────────────
        const newName = `ACC-02 Edited ${Date.now()}`;
        const patchResponse = await page.request.patch(
            `${API_URL}/api/v1/protected/accommodations/${accommodation.id}`,
            {
                data: { name: newName },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            patchResponse.ok(),
            `expected PATCH to succeed (got ${patchResponse.status()})`
        ).toBe(true);

        // ── Assert revalidation scheduled for this entity ─────────────────
        await assertRevalidationTriggered({
            since,
            entityType: 'accommodation',
            entityId: accommodation.id,
            timeoutMs: 10_000
        });

        // ── DB invariant: new name persisted ──────────────────────────────
        const accAfter = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(accAfter[0]?.name).toBe(newName);
    });
});
