/**
 * Annual checkout flow — happy path (SPEC-143 T-143-09 sub-commit 1).
 *
 * Validates the first leg of the annual subscription flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/start-paid
 *      { planSlug, billingInterval: 'annual' }
 *
 * → service calls billing.checkout.create({ mode: 'payment' })
 * → QZPay-core invokes paymentAdapter.checkout.create() under the hood
 *   (the mp-stub intercepts that call)
 * → service INSERTs billing_subscriptions row with status='pending_provider'
 *   and metadata.annualSubscriptionId = localSubscriptionId
 * → handler returns 201 { checkoutUrl, localSubscriptionId, expiresAt }
 * ```
 *
 * Webhook activation (the second leg) is covered in a follow-up sub-commit.
 *
 * @module test/e2e/flows/billing/annual-checkout
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
                    'mp-stub adapter not initialized — annual-checkout.test.ts must wire stubRef before the first request'
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

describe('SPEC-143 T-143-09 — annual checkout (happy path)', () => {
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
            email: `annual-checkout-${Date.now()}@example.com`
        });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('creates a pending_provider subscription and returns the provider checkout URL', async () => {
        // ARRANGE — stub the adapter call qzpay-core will make
        const expectedCheckoutUrl = 'https://stub.example/checkout/chk_annual_xyz';
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_annual_xyz',
                url: expectedCheckoutUrl,
                status: 'pending'
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });

        // ASSERT — response shape
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

        // ASSERT — DB row created in pending_provider with the documented
        // subscription-side metadata fields (source, planSlug, annualPriceId,
        // billingInterval — see initiatePaidAnnualSubscription in
        // subscription-checkout.service.ts).
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.status).toBe('pending_provider');
        expect(row?.billingInterval).toBe('year');
        expect(row?.intervalCount).toBe(1);
        const subscriptionMetadata = row?.metadata as Record<string, unknown> | null;
        expect(subscriptionMetadata?.source).toBe('start-paid-annual');
        expect(subscriptionMetadata?.billingInterval).toBe('annual');
        expect(subscriptionMetadata?.planSlug).toBe(cheapPlanName);

        // ASSERT — webhook correlation: the handler stores
        // `annualSubscriptionId = localSubscriptionId` in the CHECKOUT row's
        // metadata so the payment.updated webhook can flip the subscription
        // to `active`. Verify the correlation key landed correctly.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(1);
        const checkoutMetadata = checkouts[0]?.metadata as Record<string, unknown> | null;
        expect(checkoutMetadata?.annualSubscriptionId).toBe(body.data.localSubscriptionId);
        expect(checkoutMetadata?.billingInterval).toBe('annual');

        // ASSERT — qzpay-core invoked the adapter exactly once
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });
});
