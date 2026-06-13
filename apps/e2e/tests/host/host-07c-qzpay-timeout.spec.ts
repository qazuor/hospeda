/**
 * HOST-07c — QZPay startTrial timeout returns 5xx with no DB writes.
 *
 * Actors: HOST mid-publish.
 * Tags: @p0 @host @billing @resilience
 *
 * Preconditions:
 *   - Host with role='HOST' and a DRAFT accommodation.
 *   - QZPay test-control endpoint mounted (env
 *     `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true` on the API).
 *   - Cloudinary not exercised here.
 *
 * What this validates:
 *  1. With `failNext({operation: 'startTrial', errorCode: 'TIMEOUT'})` armed,
 *     the publish PATCH returns a 5xx (typically 503).
 *  2. The recorded calls log includes a failed `startTrial` call.
 *  3. DB invariants: the accommodation remains DRAFT and no
 *     `billing_subscriptions` row was created — there are no half-completed
 *     state changes to clean up.
 *
 * @see SPEC-092 spec.md § HOST-07
 * @see apps/e2e/fixtures/qzpay-test-control.ts
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { createQZPayTestControl } from '../../fixtures/qzpay-test-control.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-07c: QZPay startTrial timeout @p0 @host @billing @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('startTrial timeout: PATCH returns 5xx, accommodation stays DRAFT, no sub row', async ({
        page
    }) => {
        const qzpayControl = createQZPayTestControl(API_URL);

        // Skip the test cleanly when the test-control endpoint isn't mounted.
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

        // ── Setup: HOST + DRAFT acc, no subscription yet ───────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07c'
        });

        // ── Arm the failure: next startTrial call fails with TIMEOUT ──────
        await qzpayControl.failNext({
            operation: 'startTrial',
            errorCode: 'TIMEOUT',
            errorMessage: 'QZPay startTrial exceeded 8s timeout (HOST-07c E2E)',
            scope: host.id
        });

        // ── Publish: expect 5xx ────────────────────────────────────────────
        const publishResponse = await page.request.patch(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { lifecycleState: 'ACTIVE' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            publishResponse.status() >= 500 && publishResponse.status() < 600,
            `expected 5xx on QZPay timeout, got ${publishResponse.status()}`
        ).toBe(true);

        // ── Recorded calls: failed startTrial captured ────────────────────
        const calls = await qzpayControl.getRecordedCalls('startTrial');
        const firstFailure = calls.find((call) => call.outcome !== 'ok');
        expect(
            firstFailure,
            'expected at least one failed startTrial in recorded calls'
        ).toBeDefined();

        // ── DB invariants: no half-state ──────────────────────────────────
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
        expect(subRows.length, 'no subscription row should exist after timeout').toBe(0);
    });
});
