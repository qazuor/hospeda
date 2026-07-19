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
 *  1. With `failNext({operation: 'provisionPlan', errorCode: 'TIMEOUT'})`
 *     armed, POST /start-paid fails instead of hanging or half-committing.
 *  2. The recorded calls include a failed `provisionPlan`.
 *  3. DB invariant: no `billing_subscriptions` row survives the timeout.
 *
 * A timeout is the nastier sibling of RES-01's outage: the provider may or may
 * not have acted, so the guarantee we need is that OUR side persists nothing it
 * cannot later reconcile. HOS-151 is what this protects against — a half-created
 * row whose provider resource can never be located again.
 *
 * This spec used to time out `startTrial`/`publish`, then `createSubscription`
 * (the server-side `POST /preapproval`). HOS-191 Path C removed the server-side
 * preapproval create from the accommodation checkout entirely: the ONLY provider
 * call the checkout now makes is resolving/provisioning the MercadoPago
 * `preapproval_plan` (`resolveCheckoutMpPlanId` → `POST /preapproval_plan`), which
 * runs BEFORE the local `pending_provider` subscription row is materialized. So a
 * timeout there is exactly where a checkout can be interrupted mid-flight, and the
 * invariant is even cleaner than before: if provisioning times out, nothing was
 * written, because the DB insert only happens after provisioning succeeds.
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

        // ── Arm the failure: the next plan provisioning times out (Path C) ──
        // In Path C the checkout's single provider call is the MercadoPago
        // `preapproval_plan` resolution (`resolveCheckoutMpPlanId`). The seam sits
        // at that resolver boundary — BEFORE the `billing_mp_plans` cache lookup —
        // so this fires deterministically even when the plan variant is already
        // provisioned by a prior test in the shared E2E DB.
        await qzpayControl.failNext({
            operation: 'provisionPlan',
            errorCode: 'TIMEOUT',
            errorMessage:
                'MercadoPago preapproval_plan provisioning exceeded its timeout (HOST-07c E2E)',
            scope: customerId
        });

        // ── Checkout: must fail, not hang or half-commit ────────────────────
        const response = await page.request.post(START_PAID_URL, {
            // `/start-paid` is wrapped by idempotencyKeyMiddleware: without this
            // header it 400s before reaching billing, and the armed timeout would
            // look like it never fired. The front end sends a fresh uuid per click.
            headers: { cookie: host.sessionCookie, 'X-Idempotency-Key': crypto.randomUUID() },
            data: { planSlug: 'owner-basico', billingInterval: 'monthly' }
        });
        expect(
            response.ok(),
            `checkout must not succeed on a provider timeout (got ${response.status()})`
        ).toBe(false);

        // ── Recorded calls: the failed provisioning was captured ────────────
        const calls = await qzpayControl.getRecordedCalls('provisionPlan');
        const firstFailure = calls.find((call) => call.outcome !== 'ok');
        expect(
            firstFailure,
            'expected at least one failed provisionPlan in recorded calls'
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
