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

import { randomUUID } from 'node:crypto';
import { billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    getEntitlementCacheStats
} from '../../../../src/middlewares/entitlement.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import {
    invalidSignatureHeaders,
    providerResponseFixtures,
    signWebhookPayload
} from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestPlan,
    createTestPrice,
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

    // -----------------------------------------------------------------------
    // Error paths — sub-commit 2
    //
    // The plan-change handler + initiatePaidPlanUpgrade service surface
    // five distinct error branches reachable through the upgrade flow.
    // Each test pins one branch end-to-end and asserts no checkout row
    // and no adapter call when the failure happens BEFORE the qzpay
    // checkout.create call.
    //
    // Reminder: the active cheap-plan subscription is seeded by the file-
    // level beforeEach (cheapSubscriptionId in scope), so each test below
    // starts from a clean state and only mutates what it needs.
    // -----------------------------------------------------------------------

    it('returns 400 when the user requests to change to the same plan', async () => {
        // ACT: pass the SAME planId the user is already on. The handler
        // short-circuits at line 213-217 (plan-change.ts) BEFORE the
        // service is invoked, so this is a handler-level 400, not the
        // service's 422 SAME_PLAN (which would only fire if the handler
        // had let the request through).
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(400);

        // ASSERT — no side effects.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);

        // ASSERT — sub unchanged (still on cheap plan).
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.cheap.planId);
    });

    it('returns 404 when the target plan does not exist', async () => {
        // ACT: pass a well-formed UUID that does not match any plan in
        // billing_plans. billing.plans.get() returns null and the handler
        // throws 404 at line 197-202.
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: randomUUID(),
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(404);

        // ASSERT — no side effects.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    it('returns 400 when the target plan has no price for the requested interval', async () => {
        // ARRANGE: ad-hoc plan with ONLY a monthly price. Request an
        // annual upgrade against it — the handler at line 233-242 filters
        // targetPlan.prices by interval and surfaces 400 when nothing
        // matches.
        //
        // NOTE: this 400 is handler-level. The service has its own
        // NO_MATCHING_PRICE branch (would map to 404 via
        // mapUpgradeErrorToHttp) but the handler's price filter is
        // upstream of the service, so requests fail with 400 before the
        // service ever runs. Reaching the service's 404 path would
        // require a price row that is `active: false` — leaving that
        // case to a follow-up test if the matching contract changes.
        const monthlyOnlyPlan = await createTestPlan({
            name: 'Plan Without Annual Price',
            metadata: { slug: 'monthly-only-upgrade', category: 'test-error-path' }
        });
        await createTestPrice({
            planId: monthlyOnlyPlan.planId,
            unitAmount: 800_000,
            billingInterval: 'month'
        });
        // Deliberately NO annual price on monthlyOnlyPlan.

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: monthlyOnlyPlan.planId,
            billingInterval: 'annual'
        });

        expect(response.status).toBe(400);

        // ASSERT — no side effects.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    it('returns 422 when the delta is non-positive (NOT_AN_UPGRADE: cycle already ended, no time remaining)', async () => {
        // ARRANGE: the handler decides upgrade vs downgrade by comparing
        // NORMALIZED prices (unitAmount / intervalCount). target=expensive
        // (500_000) > current=cheap (100_000), so the handler enters the
        // UPGRADE branch and dispatches to initiatePaidPlanUpgrade. The
        // service then calls computePlanChangeDelta, which returns 0 when
        // `now >= currentPeriodEnd` (no time remaining in the billing
        // cycle to prorate against — see subscription-checkout.service.ts:159).
        // A zero or negative delta triggers SubscriptionCheckoutError
        // 'NOT_AN_UPGRADE', mapped to HTTP 422 by mapUpgradeErrorToHttp.
        //
        // Force the condition by writing a past `currentPeriodEnd` onto
        // the cheap sub seeded by beforeEach. The sub stays `active` —
        // this represents the edge case where a renewal cron hasn't yet
        // run but the user issues an upgrade in the gap.
        const now = Date.now();
        const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                currentPeriodStart: sixtyDaysAgo,
                currentPeriodEnd: thirtyDaysAgo
            })
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(422);

        // ASSERT — no checkout was created (service threw before reaching
        // billing.checkout.create) and the adapter was never invoked.
        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);

        // ASSERT — sub plan_id unchanged (still on cheap; the failure
        // happens before any DB mutation).
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.cheap.planId);
    });

    it('returns 500 when the adapter response carries no checkout URL (MISSING_INIT_POINT)', async () => {
        // ARRANGE: stub the adapter to return a successful checkout but
        // with empty initPoint AND no sandboxInitPoint. qzpay-core only
        // sets `providerInitPoint` / `providerSandboxInitPoint` when the
        // adapter result has a truthy value. With both empty, the
        // service's MISSING_INIT_POINT branch (line 682) fires and
        // mapUpgradeErrorToHttp maps it to 500.
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_no_url_upgrade',
                url: ''
            })
        );

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(500);

        // ASSERT — qzpay-core invoked the adapter once, then surfaced
        // MISSING_INIT_POINT. A billing_checkouts row is still created
        // because qzpay-core writes the local checkout BEFORE the
        // adapter result is inspected for an init point — same
        // no-orphans contract used by the annual flow's identical
        // branch. Pin the count so a refactor that rolls back the
        // checkout on missing init point would surface as a test diff
        // (likely an intentional decision to keep the row + reap via
        // abandoned-checkouts cron — see SPEC-143 T-143-XX for similar
        // discussion).
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');

        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(1);

        // ASSERT — sub is unchanged (the upgrade never committed).
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs[0]?.planId).toBe(seed.cheap.planId);
    });

    // -----------------------------------------------------------------------
    // Webhook activation — sub-commit 3
    //
    // Once the user pays the prorated delta in MercadoPago, MP sends a
    // `payment.updated` IPN. The hospeda webhook handler fetches the full
    // payment via paymentAdapter.payments.retrieve, inspects the
    // metadata, and dispatches to `confirmPlanUpgrade` when
    // `planChangeUpgradeId` is present and the payment status is
    // approved/accredited (payment-logic.ts:412+ → 222).
    //
    // confirmPlanUpgrade then:
    //   Step 1: billing.subscriptions.changePlan(planChangeUpgradeId, ...)
    //           commits the local plan flip (sub.planId = newPlanId).
    //   Step 2: paymentAdapter.subscriptions.update(...) propagates to
    //           the MP preapproval — SKIPPED here because the test sub
    //           has no mpSubscriptionId (the upgrade flow does not
    //           require one for the local change; preapproval propagation
    //           is best-effort).
    //   Step 3: addon recalculation (best-effort).
    //   Step 4: record the delta payment in billing_payments.
    //
    // The three tests below mirror the annual/monthly sub-commit 3
    // webhook blocks adapted for the upgrade lifecycle (payment.updated
    // event, metadata-based correlation by planChangeUpgradeId).
    // -----------------------------------------------------------------------

    /**
     * Helper: drive the happy-path POST /change-plan to create the
     * checkout row + capture the providerPaymentId that the webhook will
     * deliver. Resets the stub config so each test's webhook assertions
     * are independent of the create-time call.
     */
    async function createPendingUpgradeCheckout(): Promise<{
        readonly providerPaymentId: string;
        readonly deltaCentavos: number;
    }> {
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_upgrade_for_activation',
                url: 'https://stub.example/checkout/upgrade-activation',
                status: 'pending'
            })
        );
        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'monthly'
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly data: { readonly deltaCentavos: number };
        };
        const deltaCentavos = body.data.deltaCentavos;
        mpStub.config.reset();
        return {
            providerPaymentId: `pay_test_${randomUUID()}`,
            deltaCentavos
        };
    }

    /**
     * Helper: build + sign an MP IPN payment.updated payload.
     */
    function buildSignedWebhookRequest(opts: {
        readonly providerPaymentId: string;
    }): {
        readonly body: string;
        readonly headers: Record<string, string>;
    } {
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'payment',
            action: 'payment.updated',
            data: { id: opts.providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    it('webhook payment.updated with matching planChangeUpgradeId commits the plan flip', async () => {
        // ARRANGE: pending upgrade checkout created via the happy path
        // (yields a deltaCentavos figure the webhook will echo back).
        const { providerPaymentId, deltaCentavos } = await createPendingUpgradeCheckout();

        // ARRANGE: stub the three adapter calls qzpay-hono + the handler
        // make. The payments.retrieve metadata carries the correlation
        // keys the upgrade handler reads — they must mirror the values
        // the upgrade service put into the checkout's metadata (see
        // subscription-checkout.service.ts:669-677).
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_upgrade_activation',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: deltaCentavos / 100, // adapter returns major units
                currency: 'ARS',
                // extractPlanChangeUpgradeMetadata (webhooks/mercadopago/utils.ts:345)
                // requires targetTransactionAmountMajor to be a real `number`,
                // not a stringified one — qzpay's payment metadata is typed as
                // Record<string, string> but the upgrade dispatch reads the
                // numeric value directly; cast through unknown to satisfy
                // both sides.
                metadata: {
                    planChangeUpgradeId: cheapSubscriptionId,
                    oldPlanId: seed.cheap.planId,
                    newPlanId: seed.expensive.planId,
                    newPriceId: seed.expensive.monthlyPriceId,
                    targetTransactionAmountMajor: 5000,
                    deltaCentavos
                } as unknown as Record<string, string>
            })
        );

        // ACT: POST the signed webhook
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT: webhook acknowledged
        expect(response.status).toBe(200);

        // ASSERT: the local plan flip committed. confirmPlanUpgrade Step 1
        // calls billing.subscriptions.changePlan, which updates sub.planId
        // in-place via the qzpay-drizzle storage adapter.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.planId).toBe(seed.expensive.planId);
        // Status stays `active` (changePlan does not flip status; the user
        // was already on an active subscription, just on a different plan).
        expect(subs[0]?.status).toBe('active');

        // ASSERT: each stub leg fired exactly once. payments.retrieve is
        // the source of truth for the metadata that drives confirmPlanUpgrade;
        // a missed call would mean the dispatcher never ran.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(1);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);
    });

    it('webhook with mismatched planChangeUpgradeId leaves the existing subscription untouched', async () => {
        // ARRANGE: pending upgrade checkout (same as happy path)
        const { providerPaymentId } = await createPendingUpgradeCheckout();

        // ARRANGE: webhook carries a *different* planChangeUpgradeId —
        // a well-formed UUID that does not match any sub in DB. The
        // handler logs the miss and returns 200 without mutating
        // anything (payment-logic.ts:236-243).
        const mismatchedSubId = randomUUID();
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_upgrade_mismatch',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: 1000,
                currency: 'ARS',
                metadata: {
                    planChangeUpgradeId: mismatchedSubId,
                    oldPlanId: seed.cheap.planId,
                    newPlanId: seed.expensive.planId,
                    newPriceId: seed.expensive.monthlyPriceId,
                    targetTransactionAmountMajor: 5000,
                    deltaCentavos: 100000
                } as unknown as Record<string, string>
            })
        );

        // ACT
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT: 200 (event acknowledged) but the real sub is unchanged.
        expect(response.status).toBe(200);

        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.planId).toBe(seed.cheap.planId);

        // ASSERT: the mismatched id obviously creates no new subscription
        // row either. confirmPlanUpgrade only mutates the row matched by
        // the metadata id; an unknown id is a no-op.
        const subsForMismatched = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, mismatchedSubId));
        expect(subsForMismatched).toHaveLength(0);
    });

    it('webhook with invalid signature is rejected with 401 and produces no DB change', async () => {
        // ARRANGE: pending upgrade checkout (same as happy path)
        const { providerPaymentId } = await createPendingUpgradeCheckout();

        // ARRANGE: configure the stub so qzpay-hono's verifySignature call
        // returns false (= signature rejected). The custom hospeda signature
        // middleware was removed (PR #1221); qzpay-hono's own middleware is
        // now the sole verification layer. When verifySignature returns false,
        // qzpay-hono short-circuits with 401 before constructEvent / any
        // handler runs.
        mpStub.config.setSuccess('webhooks.verifySignature', false);

        // ACT: build a body but use wrong-hmac headers — qzpay-hono's
        // verifySignature (via the stub returning false) rejects BEFORE the
        // handler runs.
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'payment',
            action: 'payment.updated',
            data: { id: providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const badHeaders = invalidSignatureHeaders({ body, mode: 'wrong-hmac' });

        const response = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...badHeaders
            },
            body
        });

        expect(response.status).toBe(401);

        // ASSERT: sub unchanged (still on cheap plan).
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, cheapSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.planId).toBe(seed.cheap.planId);

        // ASSERT: verifySignature was called once (qzpay-hono runs it before
        // constructEvent or any handler). constructEvent and payments.retrieve
        // must NOT be called — they are downstream of the signature gate.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(0);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Entitlement reload post-upgrade — sub-commit 4
    //
    // Mirrors the annual/monthly sub-commit 4 entitlement-reload tests for
    // the upgrade lifecycle. The mini-app probe mounts the REAL
    // entitlementMiddleware against the REAL billing instance + DB, with a
    // synthetic prelude that sets `billingEnabled` + `billingCustomerId` so
    // the middleware does not short-circuit before calling loadEntitlements.
    //
    // Pre-webhook: the sub is `active` on the cheap plan, so
    // loadEntitlements finds the active sub and surfaces the cheap plan's
    // entitlements ('public:read') and limits (ads_per_month=5). That set
    // is cached.
    //
    // Bug surfaced and fixed alongside this test:
    //   confirmPlanUpgrade (payment-logic.ts) committed the plan flip via
    //   billing.subscriptions.changePlan but did NOT invoke
    //   `clearEntitlementCache(customerId)`. The cached cheap-plan
    //   entitlement set persisted for up to 5 minutes after the webhook —
    //   a real freebie/entitlement-leak window where the user paid for the
    //   expensive plan but the middleware kept serving cheap-plan features.
    //   Fix (this commit): added the call right after Step 1 (changePlan).
    //
    // Post-webhook: the probe cache-misses (the invalidation removed the
    // entry), re-loads, and surfaces the expensive plan's declared
    // entitlements ('public:read' + 'expensive:feature') and limits
    // (ads_per_month=100).
    //
    // SCOPE NOTE: same as the annual/monthly sub-commit 4 — this validates
    // the LOAD pipeline only. ENFORCEMENT (wiring requireEntitlement /
    // gateXxx to production routes) is gap work tracked under SPEC-145 as
    // a formal sequential follow-up.
    // -----------------------------------------------------------------------

    it('webhook activation invalidates the entitlement cache and the next lookup loads the new-plan entitlements', async () => {
        // ARRANGE: pending upgrade checkout (yields the deltaCentavos the
        // webhook will echo back).
        const { providerPaymentId, deltaCentavos } = await createPendingUpgradeCheckout();

        // ARRANGE: mini-app that runs the REAL entitlementMiddleware
        // against the REAL billing instance. The synthetic prelude sets
        // billingEnabled + billingCustomerId so loadEntitlements actually
        // runs (it short-circuits when either is missing).
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', cheapCustomerId);
            return next();
        });
        probeApp.use(entitlementMiddleware());
        probeApp.get('/probe', (c) => {
            return c.json({
                entitlements: Array.from(c.get('userEntitlements') ?? []),
                limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
                billingLoadFailed: c.get('billingLoadFailed') ?? false
            });
        });

        // ARRANGE: ensure the cache singleton has no entry for this
        // customer (prior tests in this file leave the singleton populated
        // because the cache is process-wide and not cleared by
        // testDb.clean()).
        clearEntitlementCache(cheapCustomerId);

        // ACT 1: probe BEFORE webhook activation. The sub is active on
        // the cheap plan, so loadEntitlements returns the cheap plan's
        // declared entitlements and limits. The set lands in the cache.
        const preRes = await probeApp.request('/probe');
        expect(preRes.status).toBe(200);
        const preBody = (await preRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(preBody.entitlements).toContain('public:read');
        expect(preBody.entitlements).not.toContain('expensive:feature');
        expect(preBody.limits.ads_per_month).toBe(5);
        expect(preBody.billingLoadFailed).toBe(false);

        // Snapshot the cache size so we can prove exactly one entry was
        // removed by the webhook handler. The singleton may carry entries
        // for other customers from prior tests; we assert a delta of -1
        // rather than an absolute value.
        const cacheSizeBeforeWebhook = getEntitlementCacheStats().size;
        expect(cacheSizeBeforeWebhook).toBeGreaterThanOrEqual(1);

        // ACT 2: payment.updated webhook activates the upgrade. The
        // hospeda fix added in this commit calls
        // clearEntitlementCache(customerId) right after Step 1
        // (changePlan), so the cache loses this customer's entry.
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_upgrade_entitlement_reload',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: deltaCentavos / 100,
                currency: 'ARS',
                metadata: {
                    planChangeUpgradeId: cheapSubscriptionId,
                    oldPlanId: seed.cheap.planId,
                    newPlanId: seed.expensive.planId,
                    newPriceId: seed.expensive.monthlyPriceId,
                    targetTransactionAmountMajor: 5000,
                    deltaCentavos
                } as unknown as Record<string, string>
            })
        );
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const webhookRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });
        expect(webhookRes.status).toBe(200);

        // ASSERT: the webhook handler invalidated exactly this customer's
        // entry. If the clearEntitlementCache call were removed from
        // confirmPlanUpgrade, the delta would be 0 and this assertion
        // would fail — that is the regression guard.
        const cacheSizeAfterWebhook = getEntitlementCacheStats().size;
        expect(cacheSizeAfterWebhook).toBe(cacheSizeBeforeWebhook - 1);

        // ACT 3: probe AFTER upgrade. The cache miss forces
        // loadEntitlements to re-query, which now finds the sub on the
        // expensive plan and surfaces its declared entitlements + limits.
        const postRes = await probeApp.request('/probe');
        expect(postRes.status).toBe(200);
        const postBody = (await postRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        // The expensive plan declares ['public:read', 'expensive:feature']
        // (apps/api/test/e2e/setup/seed-helpers.ts:352). Both must be
        // surfaced after the cache reload.
        expect(postBody.entitlements).toContain('public:read');
        expect(postBody.entitlements).toContain('expensive:feature');
        // The expensive plan declares { ads_per_month: 100 } in limits.
        expect(postBody.limits.ads_per_month).toBe(100);
        expect(postBody.billingLoadFailed).toBe(false);
    });
});
