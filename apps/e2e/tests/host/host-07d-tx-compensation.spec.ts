/**
 * HOST-07d — Post-trial-tx failure triggers cancelTrial compensation.
 *
 * Actors: HOST mid-publish, with a transient failure AFTER startTrial
 *         succeeded.
 * Tags: @p0 @host @billing @resilience
 *
 * Preconditions:
 *   - Host with role='HOST' and a DRAFT accommodation.
 *   - QZPay test-control endpoint mounted.
 *   - The publish flow performs `startTrial` first, then a follow-up
 *     QZPay call (e.g. `updateSubscription`) before persisting state.
 *
 * What this validates:
 *  1. `startTrial` succeeds; the next QZPay operation in the flow is forced
 *     to fail.
 *  2. The publish PATCH returns 5xx.
 *  3. The recorded calls include `cancelTrial` — the compensation called
 *     in response to the post-trial failure.
 *  4. DB invariants: the accommodation remains DRAFT and no
 *     `billing_subscriptions` row was created (the trial was rolled back).
 *
 * @see SPEC-092 spec.md § HOST-07
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { createQZPayTestControl } from '../../fixtures/qzpay-test-control.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-07d: post-trial compensation @p0 @host @billing @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    // SPEC-217 T-012 / FINDING 2: deferred. Post-trial compensation (cancelTrial) is
    // triggered by a LOCAL write failure AFTER startTrial succeeds — the publish flow
    // performs no post-startTrial QZPay op (no updateSubscription), so the QZPay
    // test-control (which injects QZPay-op faults only) cannot produce the trigger.
    // The compensation contract IS covered deterministically by service-core unit tests
    // (packages/service-core/test/services/accommodation/publish.test.ts —
    // "compensation when post-trial tx fails" + the double-failure path). Re-enable this
    // e2e only if a local-write fault seam is added.
    test.fixme(
        'startTrial OK + updateSubscription fails → cancelTrial fires as compensation',
        async ({ page }) => {
            const qzpayControl = createQZPayTestControl(API_URL);

            try {
                await qzpayControl.snapshot();
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                test.fixme(
                    /qzpay-test-control endpoint not mounted/.test(msg),
                    'qzpay-test-control disabled — set HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true on API'
                );
                return;
            }
            await qzpayControl.reset();

            // ── Setup: HOST + DRAFT acc, no subscription ──────────────────────
            const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
            userId = host.id;
            await forceVerifyEmail(host.id);

            const accommodation = await createAccommodation({
                ownerId: host.id,
                lifecycleState: 'DRAFT',
                slugPrefix: 'host-07d'
            });

            // ── Arm post-trial failure: updateSubscription throws ─────────────
            // startTrial is left untouched; failNext is queued only for the
            // follow-up operation. The exact follow-up depends on the publish
            // flow — `updateSubscription` is the likely candidate.
            await qzpayControl.failNext({
                operation: 'updateSubscription',
                errorCode: 'POST_TRIAL_TX_FAILURE',
                errorMessage: 'Forced post-trial DB failure (HOST-07d E2E)'
            });

            // ── Publish: expect 5xx ────────────────────────────────────────────
            const publishResponse = await page.request.patch(
                `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
                {
                    data: { lifecycleState: 'ACTIVE' },
                    headers: { cookie: host.sessionCookie }
                }
            );
            // The handler may translate the failure to 4xx (validation) or 5xx
            // (transient). What matters is that it does NOT report 200, and
            // that the compensation hook ran.
            expect(
                publishResponse.status() !== 200 && publishResponse.status() !== 204,
                `expected non-2xx after forced failure, got ${publishResponse.status()}`
            ).toBe(true);

            // ── Compensation: cancelTrial in recorded calls ───────────────────
            const allCalls = await qzpayControl.getRecordedCalls();
            const cancelTrialCalls = allCalls.filter((call) => call.operation === 'cancelTrial');
            const startTrialCalls = allCalls.filter((call) => call.operation === 'startTrial');

            // The contract: if startTrial succeeded and a subsequent op failed,
            // cancelTrial must have been invoked at least once for compensation.
            // If startTrial did not run (because the implementation uses a
            // different operation order), the test marks itself fixme so the
            // contract gap is visible rather than silently passing.
            if (startTrialCalls.length === 0) {
                test.fixme(
                    true,
                    'publish flow did not call startTrial — wire-up gap; revisit test once flow is stabilized'
                );
                return;
            }
            expect(
                cancelTrialCalls.length,
                `expected cancelTrial compensation after post-trial failure (got ${cancelTrialCalls.length})`
            ).toBeGreaterThanOrEqual(1);

            // ── DB invariants ─────────────────────────────────────────────────
            const accAfter = await execSQL<{ lifecycle_state: string }>(
                'SELECT lifecycle_state FROM accommodations WHERE id = $1',
                [accommodation.id]
            );
            expect(accAfter[0]?.lifecycle_state).toBe('DRAFT');

            const subRows = await execSQL(
                `SELECT s.id FROM billing_subscriptions s
             JOIN billing_customers c ON s.customer_id = c.id
             WHERE c.external_id = $1`,
                [host.id]
            );
            expect(subRows.length, 'no subscription row should exist after compensation').toBe(0);
        }
    );
});
