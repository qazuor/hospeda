/**
 * Annual call-site wiring regression test (HOS-171 §7.2, AC-11; HOS-191 Path C).
 *
 * `initiatePaidAnnualSubscription` used to delegate to a dedicated
 * `createAnnualSubscription` helper that built a one-time Checkout Pro charge
 * (`billing.checkout.create({ mode: 'payment' })`). That helper is gone: annual
 * became a RECURRING preapproval created through the exact same
 * `createPaidSubscription` helper the monthly path used (HOS-171), differing
 * only by `billingInterval: 'annual'`.
 *
 * HOS-191 removed the server-side preapproval create entirely (MercadoPago
 * rejects a `POST /preapproval` built from a `preapproval_plan_id` with
 * "card_token_id is required" unless a card was already tokenized). Both
 * monthly and annual now resolve/provision an MP `preapproval_plan` and
 * materialize a `pending_provider` subscription via
 * `createPendingProviderSubscription`, redirecting to MercadoPago's hosted
 * share link instead.
 *
 * This test guards the WIRING at that new boundary — that the resolved
 * plan/price/urls/customerId/trial are threaded into `resolveCheckoutMpPlanId`
 * and `createPendingProviderSubscription` with the right cadence, and that NO
 * preapproval or hosted checkout is ever created server-side.
 *
 * @module test/services/subscription-checkout-annual-wiring
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import { initiatePaidAnnualSubscription } from '../../src/services/subscription-checkout.service';

// HOS-191: the real Initiate* flows now resolve/provision a MercadoPago
// preapproval_plan via `resolveCheckoutMpPlanId`, which reaches the payment
// adapter singleton + `billing_mp_plans`. Stub it at this one boundary so this
// wiring test exercises the checkout decision logic without a live adapter or
// DB. `buildPreapprovalPlanShareLink` is a pure function kept REAL (via
// `importOriginal`) so `checkoutUrl` assertions exercise the actual
// URL-building logic. The provisioning service itself is unit-tested in
// `mp-plan-provisioning.test.ts`.
vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

// HOS-191 Path C: no preapproval / local subscription is created via
// `billing.subscriptions.create` any more — `createPendingProviderSubscription`
// materializes the `pending_provider` row + correlation row instead. Mocked
// here so this wiring test does not require a live DB; the helper itself is
// unit-tested in `pending-provider-subscription-create.test.ts`.
vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: vi.fn()
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const ANNUAL_PRICE_ID = 'price_annual_1';
const PLAN_METADATA = { displayName: 'Premium' };
const LOCAL_SUB_ID = 'sub-annual-local-1';

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/failure/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const CUSTOMER_FIXTURE = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

const EXPECTED_SHARE_LINK =
    'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=mp_plan_test';

/**
 * qzpay mock. No `subscriptions.create`/`checkout.create` call is ever made by
 * the annual path any more — `customers.get` is what
 * `createPendingProviderSubscription`'s caller needs (payer email + livemode).
 */
function createBillingMock(planMetadata: Record<string, unknown> = PLAN_METADATA) {
    return {
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: PLAN_ID,
                        name: 'owner-premium',
                        metadata: planMetadata,
                        prices: [
                            {
                                id: ANNUAL_PRICE_ID,
                                billingInterval: 'year',
                                intervalCount: 1,
                                active: true,
                                unitAmount: 35_000_000
                            }
                        ]
                    }
                ]
            })
        },
        subscriptions: {
            // Only reached if a trial is in play; a prior subscription would
            // disqualify one. Empty = trial-eligible customer.
            getByCustomerId: vi.fn().mockResolvedValue([])
        },
        customers: { get: vi.fn().mockResolvedValue(CUSTOMER_FIXTURE) },
        checkout: { create: vi.fn() }
    };
}

function callAnnual(billing: ReturnType<typeof createBillingMock>) {
    return initiatePaidAnnualSubscription({
        customerId: CUSTOMER_ID,
        planSlug: 'owner-premium',
        billing: billing as unknown as Parameters<
            typeof initiatePaidAnnualSubscription
        >[0]['billing'],
        urls: ANNUAL_URLS
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initiatePaidAnnualSubscription wiring (HOS-171 AC-11, HOS-191 Path C)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createPendingProviderSubscription).mockResolvedValue({
            localSubscriptionId: LOCAL_SUB_ID,
            nonce: 'nonce-test',
            expiresAt: '2099-01-01T00:00:00.000Z'
        });
    });

    it('resolves the MP plan at the annual cadence and materializes a pending_provider subscription, not a one-time checkout', async () => {
        // Arrange — a plan with no trial keeps this test about the cadence alone
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: false, trialDays: 0 });

        // Act
        const result = await callAnnual(billing);

        // Assert — the whole point of §7.2/HOS-191: annual resolves the SAME
        // kind of MP plan/pending-subscription flow monthly does, just at a
        // 12-month cadence, and never creates a preapproval server-side.
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledTimes(1);
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({
                commercialPlanId: PLAN_ID,
                billingInterval: 'annual',
                trialDays: 0,
                backUrl: ANNUAL_URLS.successUrl
            })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: ANNUAL_PRICE_ID,
                billingInterval: 'annual',
                mpPreapprovalPlanId: 'mp_plan_test',
                payerEmail: CUSTOMER_FIXTURE.email,
                trialGranted: false
            })
        );
        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
        expect(result.appliedEffect).toBeUndefined();
    });

    it('never creates a hosted Checkout Pro session for annual', async () => {
        // Arrange
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: false, trialDays: 0 });

        // Act
        await callAnnual(billing);

        // Assert — the one-time charge path is gone entirely
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });

    it("uses the success url as the preapproval's single back_url", async () => {
        // Arrange — a preapproval has ONE back_url; cancelUrl has no equivalent
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: false, trialDays: 0 });

        // Act
        await callAnnual(billing);

        // Assert
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ backUrl: ANNUAL_URLS.successUrl })
        );
    });

    it('carries the plan trial into the annual MP plan resolution and the pending subscription marker', async () => {
        // Arrange — a trial-eligible customer (no prior subscriptions) on a
        // 14-day plan: card-first means the trial is baked into the resolved
        // MP plan (the pending subscription just carries the boolean marker).
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: true, trialDays: 14 });

        // Act
        await callAnnual(billing);

        // Assert — trialDays is expressed regardless of the 12-month cadence
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ billingInterval: 'annual', trialDays: 14 })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: true })
        );
    });

    it('grants no trial on annual when the customer already has an authorized subscription', async () => {
        // Arrange — one trial per customer, for life, cross-interval. `expired` is
        // an authorized subscription that ran its course; post-HOS-230 the gate no
        // longer counts never-authorized backouts, but this one is unambiguous.
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: true, trialDays: 14 });
        billing.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-prior', status: 'expired' }
        ]);

        // Act
        await callAnnual(billing);

        // Assert
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0 })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: false })
        );
    });
});
