/**
 * Plan upgrade flow — happy path (SPEC-143 T-143-11 sub-commit 1).
 *
 * Validates the first leg of the paid plan upgrade flow:
 *
 * ```
 * POST /api/v1/protected/billing/subscriptions/change-plan
 *      { newPlanId, billingInterval: 'monthly' }
 *
 * → plan-change.ts handler detects upgrade (normalized newPrice > currentPrice)
 * → initiatePaidPlanUpgrade in subscription-checkout.service.ts:
 *     . resolves current sub + currentPlan + targetPlan via billing.*
 *     . computes prorated delta via computePlanChangeDelta
 *     . calls billing.checkout.create({ mode: 'payment', lineItems: [delta...] })
 *       with metadata carrying planChangeUpgradeId, oldPlanId, newPlanId,
 *       newPriceId, targetTransactionAmountMajor, deltaCentavos so the
 *       payment.updated webhook can finish the transition
 * → handler returns 200 { status: 'pending_payment', checkoutUrl,
 *                         localSubscriptionId, expiresAt, newPlanId,
 *                         deltaCentavos }
 * ```
 *
 * IMPORTANT contract: the LOCAL subscription is NOT mutated by this leg.
 * The plan flip is committed by `confirmPlanUpgrade` (payment-logic.ts)
 * after the user pays the prorated delta and the payment.updated webhook
 * lands. Sub-commit 3 covers that second leg.
 *
 * @module test/e2e/flows/billing/plan-upgrade
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
                    'mp-stub adapter not initialized — plan-upgrade.test.ts must wire stubRef before the first request'
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
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref that the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-11 — plan upgrade', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let seed: TestBillingPlansSeed;
    let cheapSubscriptionId: string;
    let cheapCustomerId: string;

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
        // linked by external_id, build an authenticated client. The customer
        // carries a mercadopago provider id because the upgrade flow uses
        // `billing.checkout.create` which does NOT require it but downstream
        // confirmPlanUpgrade (Step 2) does — keep the field populated so
        // sub-commits 3 + 4 can share the same beforeEach.
        seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `plan-upgrade-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        cheapCustomerId = customer.customerId;

        // Seed an ACTIVE monthly subscription on the cheap plan. Sub-commit 1
        // (happy path) and sub-commit 2 (error paths) both need a baseline
        // active sub the handler can resolve via
        // billing.subscriptions.getByCustomerId + filter status='active'.
        const sub = await createTestSubscription({
            customerId: cheapCustomerId,
            planId: seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-factory-plan-upgrade' }
        });
        cheapSubscriptionId = sub.subscriptionId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('returns 200 pending_payment with the prorated delta checkout for an active cheap-plan user upgrading to expensive', async () => {
        // ARRANGE — stub the adapter call qzpay-core's checkout flow makes.
        // `initiatePaidPlanUpgrade` invokes billing.checkout.create with the
        // delta as a single line item; that translates to a one-time
        // paymentAdapter.checkout.create call (NOT subscriptions.create —
        // monthly subs use the existing preapproval; the upgrade is a
        // separate one-shot delta payment).
        const expectedCheckoutUrl = 'https://stub.example/checkout/upgrade_delta_xyz';
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_upgrade_delta_xyz',
                url: expectedCheckoutUrl,
                status: 'pending'
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'monthly'
        });

        // ASSERT — response shape (PlanChangePendingPaymentResponseSchema).
        // status='pending_payment' is the SPEC-141 D7 upgrade branch return
        // shape; the legacy synchronous 'active'/'scheduled' shape is used
        // by the downgrade branch only.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly status: 'pending_payment';
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
                readonly expiresAt: string;
                readonly newPlanId: string;
                readonly deltaCentavos: number;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending_payment');
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
        expect(body.data.localSubscriptionId).toBe(cheapSubscriptionId);
        expect(body.data.newPlanId).toBe(seed.expensive.planId);
        // Prorated delta is positive (target price > current price) and at
        // most equals the full monthly delta (1k - 100k centavos = 400k for
        // the baseline plans: expensive monthly = 500_000 - cheap monthly =
        // 100_000 = 400_000 centavos at most; the actual figure depends on
        // the remaining-period ratio so we assert a positive number rather
        // than a fixed value).
        expect(body.data.deltaCentavos).toBeGreaterThan(0);
        expect(body.data.deltaCentavos).toBeLessThanOrEqual(400_000);
        expect(body.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — DB invariant: the local subscription is NOT mutated by
        // this leg. plan_id remains on cheap; status remains 'active'.
        // confirmPlanUpgrade (payment-logic.ts) is the only path that flips
        // plan_id, and it runs only after the payment.updated webhook.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.planId).toBe(seed.cheap.planId);
        expect(subs[0]?.status).toBe('active');

        // ASSERT — webhook correlation: the upgrade handler creates a single
        // billing_checkouts row whose metadata carries planChangeUpgradeId
        // (= the current subscription id) so the payment.updated webhook
        // can finish the transition. Pin the metadata shape because every
        // downstream consumer (confirmPlanUpgrade extraction, audit log,
        // dead-letter retry) reads these exact keys.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(1);
        const checkoutMetadata = checkouts[0]?.metadata as Record<string, unknown> | null;
        expect(checkoutMetadata?.planChangeUpgradeId).toBe(cheapSubscriptionId);
        expect(checkoutMetadata?.oldPlanId).toBe(seed.cheap.planId);
        expect(checkoutMetadata?.newPlanId).toBe(seed.expensive.planId);
        expect(checkoutMetadata?.deltaCentavos).toBe(body.data.deltaCentavos);
        // targetTransactionAmountMajor is forwarded to MP in major currency
        // units (qzpay stores in centavos; MP's preapproval transaction_amount
        // expects major). Pin the conversion so a future refactor that
        // forgets the /100 breaks the test.
        expect(checkoutMetadata?.targetTransactionAmountMajor).toBe(5000);

        // ASSERT — qzpay-core invoked the adapter exactly once for the
        // delta checkout. No subscriptions.* or payments.* calls fire
        // during initiation; those only enter the picture during the
        // payment.updated webhook (sub-commit 3).
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });
});
