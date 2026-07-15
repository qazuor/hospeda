/**
 * HOST-07c — MercadoPago timeout during checkout leaves no half-state.
 *
 * Actors: HOST starting a paid subscription.
 * Tags: @p0 @host @billing @resilience
 *
 * Preconditions:
 *   - Host with role='HOST' and a billing customer (no subscription yet).
 *   - QZPay test-control endpoint mounted.
 *
 * What this validates:
 *  1. With `failNext({operation: 'createSubscription', errorCode: 'TIMEOUT'})`
 *     armed, POST /start-paid fails instead of hanging or half-committing.
 *  2. The recorded calls include a failed `createSubscription`.
 *  3. DB invariant: no `billing_subscriptions` row survives the timeout.
 *
 * A timeout is the nastier sibling of RES-01's outage: the provider may or may
 * not have acted, so the guarantee we need is that OUR side persists nothing it
 * cannot later reconcile. HOS-151 is what this protects against — an `incomplete`
 * row whose preapproval can never be located again.
 *
 * This spec used to time out `startTrial` and drive `publish`. HOS-171 deleted the
 * no-card trial: publishing requires a card now and never reaches billing, so the
 * provider call it was modelling no longer exists there. The checkout is where a
 * timeout can actually strand a subscription.
 *
 * @see SPEC-092 spec.md § HOST-07
 */

import { expect, test } from '@playwright/test';
import { createUser, ensureBillingCustomer, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { createQZPayTestControl } from '../../fixtures/qzpay-test-control.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const START_PAID_URL = `${API_URL}/api/v1/protected/billing/subscriptions/start-paid`;

test.describe('HOST-07c: MP timeout during checkout @p0 @host @billing @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('preapproval timeout: checkout fails and no subscription row is left behind', async ({
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

        // ── Setup: HOST with a billing customer, no subscription yet ────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        // Scoping is by billing customer id, not user id — see the seam's
        // `extractScope` (@repo/billing). It must exist before arming.
        const { customerId } = await ensureBillingCustomer({ userId: host.id });

        // ── Arm the failure: the next preapproval create times out ──────────
        await qzpayControl.failNext({
            operation: 'createSubscription',
            errorCode: 'TIMEOUT',
            errorMessage: 'MercadoPago preapproval create exceeded its timeout (HOST-07c E2E)',
            scope: customerId
        });

        // ── Checkout: must fail, not hang or half-commit ────────────────────
        const response = await page.request.post(START_PAID_URL, {
            headers: { cookie: host.sessionCookie },
            data: { planSlug: 'owner-basico', billingInterval: 'monthly' }
        });
        expect(
            response.ok(),
            `checkout must not succeed on a provider timeout (got ${response.status()})`
        ).toBe(false);

        // ── Recorded calls: the failed create was captured ──────────────────
        const calls = await qzpayControl.getRecordedCalls('createSubscription');
        const firstFailure = calls.find((call) => call.outcome !== 'ok');
        expect(
            firstFailure,
            'expected at least one failed createSubscription in recorded calls'
        ).toBeDefined();

        // ── DB invariant: no orphan row ─────────────────────────────────────
        const subs = await execSQL(
            `SELECT s.id FROM billing_subscriptions s
             JOIN billing_customers c ON s.customer_id = c.id
             WHERE c.external_id = $1`,
            [host.id]
        );
        expect(subs.length, 'a timed-out checkout must leave no subscription row').toBe(0);
    });
});
