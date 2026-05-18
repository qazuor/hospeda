/**
 * Monthly checkout flow — happy path (SPEC-143 T-143-10 sub-commit 1).
 *
 * Validates the first leg of the paid monthly subscription flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/start-paid
 *      { planSlug, billingInterval: 'monthly' }
 *
 * → service calls billing.subscriptions.create({ mode: 'paid' })
 * → qzpay-core inserts billing_subscriptions row via storage adapter
 * → qzpay-core invokes paymentAdapter.subscriptions.create() under the hood
 *   (the mp-stub intercepts that call)
 * → qzpay-core updates the local row with mp_subscription_id (the provider
 *   preapproval id)
 * → handler returns 201 { checkoutUrl, localSubscriptionId, expiresAt }
 * ```
 *
 * Unlike the annual flow (one-time `checkout.create({ mode: 'payment' })`),
 * the monthly flow drives a preapproval-based recurring authorization. The
 * `subscription_preapproval.updated` webhook (covered in sub-commit 3) is
 * what flips the local sub from its initial state to `active` after the
 * user authorizes on MP's hosted page.
 *
 * @module test/e2e/flows/billing/monthly-checkout
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// vi.mock is also hoisted. The factory closes over `stubRef` and returns the
// current adapter every time `createMercadoPagoAdapter` is invoked. This lets
// the QZPay billing middleware lazy-initialize against the stub instead of a
// real MP adapter that would try to reach the network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — monthly-checkout.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref that the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-10 — monthly checkout', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;

    beforeAll(async () => {
        await testDb.setup();
        // Clear any cached real adapter that another file may have built.
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // Each test starts clean: seed plans, create a user + billing customer
        // linked by external_id, build an authenticated client.
        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `monthly-checkout-${Date.now()}@example.com`
        });
        // The monthly flow drives qzpay-core's `billing.subscriptions.create`,
        // which reads `customer.providerCustomerIds[mercadopago]` to address
        // the preapproval API. The annual flow does not need this because
        // `billing.checkout.create({ mode: 'payment' })` does not touch the
        // customer in MP. Set a stable test id so the create call lands.
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('creates a subscription via preapproval and returns the provider init point', async () => {
        // ARRANGE — stub the adapter call qzpay-core will make for the
        // monthly preapproval. MercadoPago returns 'pending' for a freshly
        // created preapproval (the user hasn't authorized yet); the
        // adapter's mapStatus passes 'pending' through and qzpay-core
        // forwards it to the storage adapter. The hosted-page url comes
        // back as `initPoint`.
        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_monthly_xyz';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_monthly_xyz',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });

        // ASSERT — response shape mirrors the annual flow so the route
        // handler can return either uniformly. See
        // InitiatePaidMonthlySubscriptionResult in
        // apps/api/src/services/subscription-checkout.service.ts.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
                readonly expiresAt: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
        expect(body.data.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — DB row: qzpay-core inserts the subscription via its
        // storage adapter, then updates the row with `mpSubscriptionId`
        // (the provider preapproval id) after the adapter call lands.
        // See packages/core/src/billing.ts:1292-1294. The
        // service-side metadata stamps `source: 'start-paid-monthly'`
        // so the downstream cron + audit log can attribute the row.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.mpSubscriptionId).toBe('sub_monthly_xyz');
        const subscriptionMetadata = row?.metadata as Record<string, unknown> | null;
        expect(subscriptionMetadata?.source).toBe('start-paid-monthly');

        // ASSERT — monthly does NOT create a billing_checkouts row. That
        // table is populated only by the annual one-time `checkout.create`
        // path (see initiatePaidAnnualSubscription). Validating zero
        // checkouts here pins the contract: if someone refactors the
        // monthly handler to use the checkout table, this test fails.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // ASSERT — qzpay-core invoked the adapter exactly once. No
        // payments.* or webhooks.* calls fire during initiation; those
        // only enter the picture during the `subscription_preapproval.updated`
        // webhook (sub-commit 3).
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });
});
