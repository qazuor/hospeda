/**
 * Annual call-site wiring regression test (HOS-171 §7.2, AC-11).
 *
 * `initiatePaidAnnualSubscription` used to delegate to a dedicated
 * `createAnnualSubscription` helper that built a one-time Checkout Pro charge
 * (`billing.checkout.create({ mode: 'payment' })`). That helper is gone: annual
 * is now a RECURRING preapproval created through the exact same
 * `createPaidSubscription` helper the monthly path uses, differing only by
 * `billingInterval: 'annual'`.
 *
 * This test guards the WIRING at the qzpay boundary — that the resolved
 * plan/price/urls/customerId are threaded into `billing.subscriptions.create`
 * with the right cadence and mode, and that NO hosted checkout is created. It
 * deliberately does not mock `createPaidSubscription`: that helper IS the
 * contract under test here, so it runs for real against a mocked qzpay.
 *
 * @module test/services/subscription-checkout-annual-wiring
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initiatePaidAnnualSubscription } from '../../src/services/subscription-checkout.service';

// HOS-191: the real Initiate* flows now resolve/provision a MercadoPago
// preapproval_plan via `resolveCheckoutMpPlanId`, which reaches the payment
// adapter singleton + `billing_mp_plans`. Stub it at this one boundary so this
// wiring test exercises the checkout decision logic without a live adapter or
// DB. The provisioning service itself is unit-tested in
// `mp-plan-provisioning.test.ts`.
vi.mock('../../src/services/billing/mp-plan-provisioning.service', () => ({
    resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
    resolveOrProvisionMpPlan: vi.fn()
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const ANNUAL_PRICE_ID = 'price_annual_1';
const PLAN_METADATA = { displayName: 'Premium' };
const MP_PREAPPROVAL_ID = 'preapproval-annual-1';

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/failure/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/**
 * qzpay mock. `subscriptions.create` resolves the shape
 * `createPaidSubscription` needs to succeed: an init point plus a provider
 * subscription id (it fails closed without either).
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
            create: vi.fn().mockResolvedValue({
                id: 'sub-annual-local-1',
                livemode: false,
                providerInitPoint: 'https://mp.test/checkout/annual-preapproval',
                providerSubscriptionIds: { mercadopago: MP_PREAPPROVAL_ID }
            }),
            // Only reached if a trial is in play; a prior subscription would
            // disqualify one. Empty = trial-eligible customer.
            getByCustomerId: vi.fn().mockResolvedValue([]),
            cancel: vi.fn()
        },
        customers: { get: vi.fn() },
        checkout: { create: vi.fn() },
        getStorage: vi.fn(() => ({}))
    };
}

function makeStubDb() {
    return {
        insert() {
            throw new Error(
                "db.insert must not be called by initiatePaidAnnualSubscription — the local row is qzpay's to write now (mode: paid)"
            );
        }
    } as unknown as Parameters<typeof initiatePaidAnnualSubscription>[0]['db'];
}

function callAnnual(billing: ReturnType<typeof createBillingMock>) {
    return initiatePaidAnnualSubscription({
        customerId: CUSTOMER_ID,
        planSlug: 'owner-premium',
        billing: billing as unknown as Parameters<
            typeof initiatePaidAnnualSubscription
        >[0]['billing'],
        urls: ANNUAL_URLS,
        db: makeStubDb()
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initiatePaidAnnualSubscription wiring to createPaidSubscription (HOS-171 AC-11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a recurring preapproval at the annual cadence, not a one-time checkout', async () => {
        // Arrange — a plan with no trial keeps this test about the cadence alone
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: false, trialDays: 0 });

        // Act
        const result = await callAnnual(billing);

        // Assert — the whole point of §7.2: annual is a preapproval now
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: ANNUAL_PRICE_ID,
                mode: 'paid',
                billingInterval: 'annual',
                notificationUrl: ANNUAL_URLS.notificationUrl
            })
        );
        expect(result.checkoutUrl).toBe('https://mp.test/checkout/annual-preapproval');
        expect(result.localSubscriptionId).toBe('sub-annual-local-1');
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
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethodReturnUrl: ANNUAL_URLS.successUrl })
        );
    });

    it('carries the plan trial into the annual preapproval as free_trial days', async () => {
        // Arrange — a trial-eligible customer (no prior subscriptions) on a
        // 14-day plan: card-first means the trial rides the SAME preapproval
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: true, trialDays: 14 });

        // Act
        await callAnnual(billing);

        // Assert — free_trial is expressed in DAYS regardless of the 12-month cadence
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ billingInterval: 'annual', freeTrialDays: 14 })
        );
    });

    it('grants no trial on annual when the customer already has a subscription', async () => {
        // Arrange — one trial per customer, for life, cross-interval
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: true, trialDays: 14 });
        billing.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-prior', status: 'canceled' }
        ]);

        // Act
        await callAnnual(billing);

        // Assert
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.freeTrialDays).toBeUndefined();
    });

    it('threads the plan slug into the preapproval metadata', async () => {
        // Arrange
        const billing = createBillingMock({ ...PLAN_METADATA, hasTrial: false, trialDays: 0 });

        // Act
        await callAnnual(billing);

        // Assert
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.planSlug).toBe('owner-premium');
        expect(metadata.source).toBe('start-paid-annual');
    });
});
