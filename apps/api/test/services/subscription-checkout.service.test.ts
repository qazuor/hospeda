/**
 * Unit tests for the subscription-checkout service (SPEC-126 D8).
 *
 * Covers:
 * - initiatePaidMonthlySubscription happy path: invokes qzpay with the
 *   right arguments, returns the response with sandbox-init-point fallback.
 * - Throws PLAN_NOT_FOUND when the slug does not match any plan.
 * - Throws NO_MONTHLY_PRICE when the plan has no active monthly price
 *   (covers inactive prices and multi-month variants like quarterly).
 * - Throws MISSING_INIT_POINT when qzpay returns a sub without an init
 *   point (adapter misconfiguration).
 * - PENDING_PROVIDER_TTL_MS is 30 minutes -- matches the front-end's
 *   `expiresAt` expectation and the abandoned-pending-subs cron's TTL.
 *
 * No HTTP context or env mock is required because the service is
 * framework-agnostic.
 *
 * @module test/services/subscription-checkout.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import {
    computePlanChangeDelta,
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription,
    initiatePaidPlanUpgrade,
    PENDING_PROVIDER_TTL_MS,
    SubscriptionCheckoutError
} from '../../src/services/subscription-checkout.service';

// HOS-191: the real Initiate* flows now resolve/provision a MercadoPago
// preapproval_plan via `resolveCheckoutMpPlanId`, which reaches the payment
// adapter singleton + `billing_mp_plans`. Stub it at this one boundary so
// these framework-agnostic service tests exercise the checkout decision
// logic without a live adapter or DB. `buildPreapprovalPlanShareLink` is a
// pure function kept REAL (via `importOriginal`) so `checkoutUrl` assertions
// exercise the actual URL-building logic. The provisioning service itself is
// unit-tested in `mp-plan-provisioning.test.ts`.
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

// HOS-191 Path C: checkout no longer creates a MercadoPago preapproval or a
// local subscription via `billing.subscriptions.create` — it materializes a
// `pending_provider` subscription + a `billing_pending_checkouts` correlation
// row via this helper instead. Mocked here so these tests exercise the
// checkout decision logic (plan/promo/trial resolution) without touching the
// DB; the helper itself is unit-tested in
// `pending-provider-subscription-create.test.ts`.
vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: vi.fn()
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MONTHLY_PRICE_ID = 'price_monthly_1';
const ANNUAL_PRICE_ID = 'price_annual_1';

interface PriceFixture {
    id: string;
    billingInterval: 'month' | 'year' | 'day' | 'week';
    intervalCount: number;
    active: boolean;
}

const MONTHLY_PRICE: PriceFixture = {
    id: MONTHLY_PRICE_ID,
    billingInterval: 'month',
    intervalCount: 1,
    active: true
};

const ANNUAL_PRICE: PriceFixture = {
    id: ANNUAL_PRICE_ID,
    billingInterval: 'year',
    intervalCount: 1,
    active: true
};

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/** The trial length declared by the plan fixtures that have one. */
const PLAN_TRIAL_DAYS = 14;

/** Metadata for a plan that declares the standard owner trial. */
const TRIAL_METADATA = { hasTrial: true, trialDays: PLAN_TRIAL_DAYS };

/**
 * Builds a plan fixture. `metadata` drives the card-first trial resolution --
 * `resolvePlanTrialConfig` reads `hasTrial`/`trialDays` off it, and a plan
 * without metadata declares no trial at all.
 */
function createPlan(prices: PriceFixture[], metadata?: Record<string, unknown>) {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices,
        ...(metadata === undefined ? {} : { metadata })
    };
}

interface CustomerFixture {
    id: string;
    email: string;
    name: string | null;
    livemode: boolean;
}

/**
 * Default billing-customer fixture. HOS-191 Path C reads `customers.get()`
 * on EVERY paid checkout (monthly and annual) now — not just the comp
 * branch — because `createPendingProviderSubscription` needs the payer's
 * email + livemode to snapshot on the correlation row.
 */
const CUSTOMER_FIXTURE: CustomerFixture = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

/**
 * Default resolved value for the mocked `createPendingProviderSubscription`.
 * A fixed sentinel `expiresAt` (rather than a live-clock computation) because
 * the TTL math now lives entirely inside that (mocked) helper — asserting it
 * here would just be re-testing the mock. The real TTL behavior is covered
 * by `pending-provider-subscription-create.test.ts`.
 */
const PENDING_RESULT = {
    localSubscriptionId: LOCAL_SUB_ID,
    nonce: 'nonce-test-1234',
    expiresAt: '2099-01-01T00:00:00.000Z'
};

interface BillingMockOpts {
    plans?: ReturnType<typeof createPlan>[];
    /**
     * Existing subscriptions for the customer. HOS-171 makes any prior
     * subscription -- any status, any domain -- disqualify the customer from a
     * trial for life. Empty (the default) means trial-eligible.
     */
    priorSubscriptions?: unknown[];
    /** Billing customer returned by `billing.customers.get()`. `null` simulates a missing customer. */
    customer?: CustomerFixture | null;
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const plans = opts.plans ?? [createPlan([MONTHLY_PRICE, ANNUAL_PRICE])];
    const customer = opts.customer === undefined ? CUSTOMER_FIXTURE : opts.customer;

    return {
        plans: {
            list: vi.fn().mockResolvedValue({ data: plans })
        },
        customers: {
            get: vi.fn().mockResolvedValue(customer)
        },
        subscriptions: {
            // HOS-171: the one-trial-per-customer-for-life gate. `startTrial`
            // used to re-check this and was the authoritative gate; it is gone,
            // so this query is now the only thing standing between a returning
            // customer and a second trial. Only reached when the plan actually
            // declares a trial.
            getByCustomerId: vi.fn().mockResolvedValue(opts.priorSubscriptions ?? [])
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PENDING_PROVIDER_TTL_MS', () => {
    it('is 30 minutes to match the front-end expiresAt expectation', () => {
        expect(PENDING_PROVIDER_TTL_MS).toBe(30 * 60 * 1000);
    });
});

// HOS-209: the share-link now carries the per-checkout nonce as
// `external_reference` (from PENDING_RESULT.nonce = 'nonce-test-1234') so MP
// stamps it on the authorized preapproval for exact-nonce (Tier 2) linking.
const EXPECTED_SHARE_LINK =
    'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=mp_plan_test&external_reference=nonce-test-1234';

describe('initiatePaidMonthlySubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createPendingProviderSubscription).mockResolvedValue(PENDING_RESULT);
    });

    it('returns the MP hosted share-link checkoutUrl, localSubscriptionId, and expiresAt on success', async () => {
        const billing = createBillingMock();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        // HOS-191 Path C: no preapproval is created server-side, so the
        // checkoutUrl is deterministically built from the resolved MP plan id
        // (mocked to 'mp_plan_test') rather than coming from a provider response.
        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        expect(result.localSubscriptionId).toBe(PENDING_RESULT.localSubscriptionId);
        expect(result.expiresAt).toBe(PENDING_RESULT.expiresAt);
    });

    it('HOS-209: stamps the pending-checkout nonce as external_reference on the share-link', async () => {
        const billing = createBillingMock();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        // Parse rather than string-match so the assertion survives param reorder.
        const url = new URL(result.checkoutUrl);
        expect(url.searchParams.get('preapproval_plan_id')).toBe('mp_plan_test');
        expect(url.searchParams.get('external_reference')).toBe(PENDING_RESULT.nonce);
    });

    it('invokes createPendingProviderSubscription with the right arguments', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: MONTHLY_PRICE_ID,
                billingInterval: 'monthly',
                mpPreapprovalPlanId: 'mp_plan_test',
                payerEmail: CUSTOMER_FIXTURE.email,
                trialGranted: false,
                livemode: CUSTOMER_FIXTURE.livemode
            })
        );
        // No preapproval / MP subscription is ever created server-side.
        expect(billing.subscriptions).not.toHaveProperty('create');
    });

    it('resolves the MP plan with the right variant key (no trial)', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({
                commercialPlanId: PLAN_ID,
                billingInterval: 'monthly',
                trialDays: 0,
                backUrl: URLS.paymentMethodReturnUrl
            })
        );
    });

    it('throws SubscriptionCheckoutError(PLAN_NOT_FOUND) when the slug is unknown', async () => {
        const billing = createBillingMock({ plans: [] });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'does-not-exist',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'PLAN_NOT_FOUND'
        });
    });

    it('throws SubscriptionCheckoutError(NO_MONTHLY_PRICE) when the plan has only annual', async () => {
        const billing = createBillingMock({
            plans: [createPlan([ANNUAL_PRICE])]
        });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'NO_MONTHLY_PRICE'
        });
    });

    it('throws NO_MONTHLY_PRICE when the only monthly price is inactive', async () => {
        const billing = createBillingMock({
            plans: [createPlan([{ ...MONTHLY_PRICE, active: false }])]
        });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toMatchObject({ code: 'NO_MONTHLY_PRICE' });
    });

    it('skips quarterly (intervalCount=3) when looking for monthly', async () => {
        // Multi-month variants belong to plan-change flows; they must not
        // silently satisfy the monthly lookup.
        const quarterly: PriceFixture = {
            id: 'price_quarterly',
            billingInterval: 'month',
            intervalCount: 3,
            active: true
        };
        const billing = createBillingMock({
            plans: [createPlan([quarterly])]
        });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toMatchObject({ code: 'NO_MONTHLY_PRICE' });
    });

    it('throws CUSTOMER_NOT_FOUND when the qzpay customer lookup returns null', async () => {
        const billing = createBillingMock({ customer: null });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'CUSTOMER_NOT_FOUND'
        });
    });

    it('does not catch unrelated errors thrown by createPendingProviderSubscription (they propagate)', async () => {
        vi.mocked(createPendingProviderSubscription).mockRejectedValueOnce(new Error('DB down'));
        const billing = createBillingMock();

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toThrow('DB down');
    });

    it('error instances carry both name and code for discrimination', () => {
        const err = new SubscriptionCheckoutError('PLAN_NOT_FOUND', 'Plan x not found');
        expect(err).toBeInstanceOf(SubscriptionCheckoutError);
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('SubscriptionCheckoutError');
        expect(err.code).toBe('PLAN_NOT_FOUND');
        expect(err.message).toBe('Plan x not found');
    });

    // -----------------------------------------------------------------------
    // Card-first trial resolution (HOS-171), superseding SPEC-126 D9.
    //
    // The trial is no longer a separate no-card mechanism that a
    // `trial_extension` promo topped up afterwards. It is baked into the MP
    // `preapproval_plan` resolved by `resolveCheckoutMpPlanId` (HOS-191), sized
    // ONCE by `resolveCheckoutFreeTrialDays`. The full resolution matrix
    // (kill-switch, summing, one-per-lifetime) is unit-tested against that
    // function directly in service-core; what these assert is that this
    // service feeds it the right inputs and wires the answer into the MP plan
    // resolution + the pending-subscription's `trialGranted` marker.
    // -----------------------------------------------------------------------

    it('sends the plan base trial as trialDays with no promo code at all', async () => {
        const billing = createBillingMock({
            plans: [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)]
        });

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: PLAN_TRIAL_DAYS })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: true })
        );
    });

    it('sums the plan base trial and FREEMONTH into ONE trialDays sent to the MP plan resolver', async () => {
        const billing = createBillingMock({
            plans: [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)]
        });

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'FREEMONTH'
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: PLAN_TRIAL_DAYS + 30 })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: true })
        );
    });

    it('treats the promo code case-insensitively (lowercase resolves)', async () => {
        const billing = createBillingMock({
            plans: [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)]
        });

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'freemonth'
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: PLAN_TRIAL_DAYS + 30 })
        );
    });

    it('grants no trial to a customer who already had any subscription', async () => {
        const billing = createBillingMock({
            plans: [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)],
            priorSubscriptions: [{ id: 'sub_from_two_years_ago' }]
        });

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'FREEMONTH'
        });

        // Charged immediately, and FREEMONTH cannot resurrect the burnt trial.
        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0 })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: false })
        );
    });

    // HOS-191 F4: end-to-end verification that the one-trial-per-customer
    // guard (`hasPriorSubscription` -> `resolveCheckoutFreeTrialDays`) still
    // decides which MP `preapproval_plan` VARIANT the Path C share link
    // points at. The test above only asserts the `trialDays` argument passed
    // to `resolveCheckoutMpPlanId`; this one additionally makes the mock
    // return a DIFFERENT plan id per `trialDays` value (mirroring how
    // `resolveOrProvisionMpPlan` really behaves -- one MP plan per commercial
    // plan x trial-day variant) and asserts the returned `checkoutUrl`
    // actually differs, proving the guard's decision reaches the customer's
    // browser and not just a mocked call argument.
    it('routes a customer WITH a prior subscription to the trial_days=0 share link, and a customer WITHOUT one to the trial share link', async () => {
        const plans = [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)];

        // Two `mockImplementationOnce` calls, consumed strictly in call
        // order by the two sequential `initiatePaidMonthlySubscription`
        // invocations below (never by inspecting the `trialDays` argument,
        // to avoid ever depending on the guard for a "graded" test double).
        // Once both are consumed the mock reverts to its module-level
        // default (`mockResolvedValue('mp_plan_test')`), so this cannot
        // leak into later tests.
        vi.mocked(resolveCheckoutMpPlanId)
            .mockImplementationOnce(async () => 'mp_plan_no_trial')
            .mockImplementationOnce(async () => 'mp_plan_with_trial');

        // Customer with ANY prior subscription (any status) is disqualified
        // from a trial for life (HOS-171) -- even in Path C.
        const returningCustomerBilling = createBillingMock({
            plans,
            priorSubscriptions: [{ id: 'sub_from_two_years_ago' }]
        });

        const returningResult = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: returningCustomerBilling as any,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ trialDays: 0 })
        );
        expect(returningResult.checkoutUrl).toContain('mp_plan_no_trial');
        expect(returningResult.checkoutUrl).not.toContain('mp_plan_with_trial');

        // A brand-new customer (no prior subscriptions at all) is
        // trial-eligible and must resolve the trial variant instead.
        const newCustomerBilling = createBillingMock({ plans, priorSubscriptions: [] });

        const newCustomerResult = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: newCustomerBilling as any,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ trialDays: PLAN_TRIAL_DAYS })
        );
        expect(newCustomerResult.checkoutUrl).toContain('mp_plan_with_trial');
        expect(newCustomerResult.checkoutUrl).not.toContain('mp_plan_no_trial');
    });

    it('grants no trial on a plan that declares none, even with FREEMONTH', async () => {
        // A plan with no trial gets none regardless of any promo (ADR-009 keeps
        // trials host-only). The extension has nothing to lengthen, so its days
        // go nowhere rather than becoming a standalone trial.
        const billing = createBillingMock();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'FREEMONTH'
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0 })
        );
        expect(result.promoCodeIgnored).toBe(true);
    });

    it('does NOT grant a trial or forward any effect when neither trial nor promo applies', async () => {
        const billing = createBillingMock();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0 })
        );
        expect(result.trialGranted).toBeUndefined();
        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBeUndefined();
    });

    it('throws INVALID_PROMO_CODE for unknown codes', async () => {
        const billing = createBillingMock();

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS,
                promoCode: 'NOT_REAL'
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'INVALID_PROMO_CODE'
        });

        // Fast-fail before ever materializing the pending subscription.
        expect(createPendingProviderSubscription).not.toHaveBeenCalled();
    });

    it('throws INVALID_PROMO_CODE for discount-type codes (only free-trial extensions allowed)', async () => {
        // BIENVENIDO30 is a discount-type promo in the config; the service
        // must reject it for monthly recurring per master plan Decision 4.
        const billing = createBillingMock();

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS,
                promoCode: 'BIENVENIDO30'
            })
        ).rejects.toMatchObject({ code: 'INVALID_PROMO_CODE' });
    });

    it('ignores empty-string promo codes (treated as no promo)', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: ''
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 0 })
        );
    });
});

// ---------------------------------------------------------------------------
// initiatePaidAnnualSubscription (SPEC-141 D1)
// ---------------------------------------------------------------------------

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/billing/return?ref=local',
    cancelUrl: 'https://hospeda.test/billing/return?ref=local&cancelled=1',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const ANNUAL_PRICE_WITH_AMOUNT = {
    id: ANNUAL_PRICE_ID,
    billingInterval: 'year' as const,
    intervalCount: 1,
    active: true,
    unitAmount: 35_000_000
};

/**
 * Billing mock for the annual flow.
 *
 * HOS-171 §7.2 collapsed annual into the monthly mechanism (a RECURRING
 * preapproval at a 12-month cadence), and HOS-191 Path C collapsed it further:
 * neither monthly nor annual create a preapproval server-side any more, so
 * this mirrors `createBillingMock` — the only annual-specific parts left are
 * the price fixture and the `billingInterval` the service must forward.
 */
function createAnnualBillingMock(
    opts: {
        plans?: Array<{ id: string; name: string; prices: unknown[]; metadata?: unknown }>;
        customer?: CustomerFixture | null;
        priorSubscriptions?: unknown[];
    } = {}
) {
    const plans = opts.plans ?? [
        {
            id: PLAN_ID,
            name: 'owner-premium',
            prices: [ANNUAL_PRICE_WITH_AMOUNT]
        }
    ];
    const customer = opts.customer === undefined ? CUSTOMER_FIXTURE : opts.customer;

    return {
        plans: { list: vi.fn().mockResolvedValue({ data: plans }) },
        customers: { get: vi.fn().mockResolvedValue(customer) },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(opts.priorSubscriptions ?? [])
        }
    };
}

describe('initiatePaidAnnualSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createPendingProviderSubscription).mockResolvedValue(PENDING_RESULT);
    });

    it('returns the MP hosted share-link checkoutUrl, localSubscriptionId, and expiresAt on success', async () => {
        const billing = createAnnualBillingMock();

        const result = await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS
        });

        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        expect(result.localSubscriptionId).toBe(PENDING_RESULT.localSubscriptionId);
        expect(result.expiresAt).toBe(PENDING_RESULT.expiresAt);
    });

    it('resolves the MP plan and materializes a pending subscription for the annual cadence', async () => {
        const billing = createAnnualBillingMock();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({
                commercialPlanId: PLAN_ID,
                billingInterval: 'annual',
                trialDays: 0,
                // A preapproval has exactly one back_url; cancelUrl has no equivalent.
                backUrl: ANNUAL_URLS.successUrl
            })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: ANNUAL_PRICE_ID,
                billingInterval: 'annual',
                mpPreapprovalPlanId: 'mp_plan_test',
                payerEmail: CUSTOMER_FIXTURE.email,
                trialGranted: false,
                livemode: CUSTOMER_FIXTURE.livemode
            })
        );
        // No preapproval / MP subscription is ever created server-side.
        expect(billing.subscriptions).not.toHaveProperty('create');
    });

    it('gives annual the same card-first trial as monthly', async () => {
        // Annual is not a different KIND of thing any more -- same preapproval
        // variant resolution, same single trial decision, just a 12-month
        // cadence. The trial stays expressed in DAYS regardless of that cadence.
        const billing = createAnnualBillingMock({
            plans: [
                {
                    id: PLAN_ID,
                    name: 'owner-premium',
                    prices: [ANNUAL_PRICE_WITH_AMOUNT],
                    metadata: TRIAL_METADATA
                }
            ]
        });

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: PLAN_TRIAL_DAYS })
        );
        expect(createPendingProviderSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ trialGranted: true })
        );
    });

    it('throws PLAN_NOT_FOUND when the slug is unknown', async () => {
        const billing = createAnnualBillingMock({ plans: [] });

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'does-not-exist',
                billing: billing as any,
                urls: ANNUAL_URLS
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('throws NO_ANNUAL_PRICE when the plan has no active annual price', async () => {
        const billing = createAnnualBillingMock({
            plans: [
                {
                    id: PLAN_ID,
                    name: 'owner-premium',
                    prices: [MONTHLY_PRICE] // only monthly, no annual
                }
            ]
        });

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS
            })
        ).rejects.toMatchObject({ code: 'NO_ANNUAL_PRICE' });
    });

    it('skips inactive annual prices', async () => {
        const billing = createAnnualBillingMock({
            plans: [
                {
                    id: PLAN_ID,
                    name: 'owner-premium',
                    prices: [{ ...ANNUAL_PRICE_WITH_AMOUNT, active: false }]
                }
            ]
        });

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS
            })
        ).rejects.toMatchObject({ code: 'NO_ANNUAL_PRICE' });
    });

    it('throws CUSTOMER_NOT_FOUND when the qzpay customer lookup returns null', async () => {
        const billing = createAnnualBillingMock({ customer: null });

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS
            })
        ).rejects.toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });
    });
});

// ---------------------------------------------------------------------------
// computePlanChangeDelta (SPEC-141 D7 upgrade — sub-decision 3)
// ---------------------------------------------------------------------------

describe('computePlanChangeDelta', () => {
    const PERIOD_START = new Date('2026-06-01T00:00:00.000Z');
    const PERIOD_END = new Date('2026-07-01T00:00:00.000Z'); // 30 days

    it('returns the prorated delta when half the period remains', () => {
        const halfwayThrough = new Date('2026-06-16T00:00:00.000Z'); // 15 days remaining of 30
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 3_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: halfwayThrough
        });
        // (3_500_000 - 1_500_000) * 15/30 = 1_000_000 centavos
        expect(delta).toBe(1_000_000);
    });

    it('returns the full delta at the very start of the period', () => {
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 3_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: PERIOD_START
        });
        expect(delta).toBe(2_000_000); // (3_500_000 - 1_500_000) * 1
    });

    it('returns 0 when the period has already ended', () => {
        const afterEnd = new Date('2026-07-15T00:00:00.000Z');
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 3_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: afterEnd
        });
        expect(delta).toBe(0);
    });

    it('returns the full delta when "now" is before period start (clamps ratio to 1)', () => {
        const beforeStart = new Date('2026-05-15T00:00:00.000Z');
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 3_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: beforeStart
        });
        // remaining = end - now > total, so ratio clamps to 1.
        expect(delta).toBe(2_000_000);
    });

    it('returns a negative value for a downgrade (caller decides what to do)', () => {
        const halfwayThrough = new Date('2026-06-16T00:00:00.000Z');
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 3_500_000,
            targetPriceCentavos: 1_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: halfwayThrough
        });
        // (1_500_000 - 3_500_000) * 15/30 = -1_000_000
        expect(delta).toBe(-1_000_000);
    });

    it('returns 0 when current and target prices are equal', () => {
        const halfwayThrough = new Date('2026-06-16T00:00:00.000Z');
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 1_500_000,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            now: halfwayThrough
        });
        expect(delta).toBe(0);
    });

    it('returns 0 for a degenerate period (start >= end) instead of throwing', () => {
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_500_000,
            targetPriceCentavos: 3_500_000,
            currentPeriodStart: PERIOD_END,
            currentPeriodEnd: PERIOD_START,
            now: PERIOD_START
        });
        expect(delta).toBe(0);
    });

    it('rounds to the nearest centavo (no fractional centavos in storage)', () => {
        // 7-day period, 3-day remaining → ratio = 3/7 ≈ 0.42857
        // delta = 1_000_000 * 0.42857 = 428571.4… → rounds to 428571
        const start = new Date('2026-06-01T00:00:00.000Z');
        const end = new Date('2026-06-08T00:00:00.000Z'); // 7 days
        const now = new Date('2026-06-05T00:00:00.000Z'); // 3 days remaining
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 0,
            targetPriceCentavos: 1_000_000,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            now
        });
        expect(delta).toBe(428_571);
    });

    it('defaults `now` to wall-clock when omitted (smoke test, not deterministic)', () => {
        // Just verify no throw + a sane number for any "now" between start and end.
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5); // 5 days ago
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 25); // 25 days from now
        const delta = computePlanChangeDelta({
            currentPriceCentavos: 1_000_000,
            targetPriceCentavos: 2_000_000,
            currentPeriodStart: start,
            currentPeriodEnd: end
        });
        // Should be close to (2M - 1M) * 25/30 ≈ 833333
        expect(delta).toBeGreaterThan(820_000);
        expect(delta).toBeLessThan(850_000);
    });
});

// ---------------------------------------------------------------------------
// initiatePaidPlanUpgrade (SPEC-141 D7 — upgrade delta-charge)
// ---------------------------------------------------------------------------

const UPGRADE_SUB_ID = 'sub-upgrade-1';
const NEW_PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const NEW_PRICE_ID = 'price_monthly_new';

const UPGRADE_PERIOD_START = new Date('2026-06-01T00:00:00.000Z');
const UPGRADE_PERIOD_END = new Date('2026-07-01T00:00:00.000Z');
const HALFWAY = new Date('2026-06-16T00:00:00.000Z'); // 15 days remaining of 30

const UPGRADE_URLS = {
    successUrl: 'https://hospeda.test/billing/return?ctx=upgrade',
    cancelUrl: 'https://hospeda.test/billing/return?ctx=upgrade&cancelled=1',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const UPGRADE_CUSTOMER: CustomerFixture = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

function priceWith(overrides: { id: string; unitAmount: number; intervalCount?: number }) {
    return {
        billingInterval: 'month',
        intervalCount: 1,
        active: true,
        ...overrides
    };
}

interface UpgradeBillingMockOpts {
    /** Active subscription returned by billing.subscriptions.get */
    subscription?: {
        id: string;
        planId: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        // interval + intervalCount surface the sub's current billing
        // cycle to `initiatePaidPlanUpgrade`. They drive the currentPrice
        // lookup (SPEC-143 T-143-61 — cycle change support). Mocks default
        // to monthly when omitted; cycle-change tests override.
        interval?: string;
        intervalCount?: number;
    } | null;
    /** Current plan returned by billing.plans.get(sub.planId) */
    currentPlan?: { id: string; name: string; prices: unknown[] } | null;
    /** Target plan returned by billing.plans.get(newPlanId) */
    targetPlan?: { id: string; name: string; prices: unknown[] } | null;
    customer?: CustomerFixture | null;
    checkoutResult?: {
        id?: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
    } | null;
}

function createUpgradeBillingMock(opts: UpgradeBillingMockOpts = {}) {
    const subscription =
        opts.subscription === undefined
            ? {
                  id: UPGRADE_SUB_ID,
                  planId: PLAN_ID,
                  currentPeriodStart: UPGRADE_PERIOD_START,
                  currentPeriodEnd: UPGRADE_PERIOD_END,
                  // Default to monthly so the matchesInterval helper at
                  // initiatePaidPlanUpgrade resolves a currentPrice that
                  // matches the monthly price defined on currentPlan.
                  // Cycle-change scenarios override this explicitly.
                  interval: 'month',
                  intervalCount: 1
              }
            : opts.subscription;

    const currentPlan =
        opts.currentPlan === undefined
            ? {
                  id: PLAN_ID,
                  name: 'owner-basico',
                  prices: [priceWith({ id: 'price_monthly_current', unitAmount: 1_500_000 })]
              }
            : opts.currentPlan;

    const targetPlan =
        opts.targetPlan === undefined
            ? {
                  id: NEW_PLAN_ID,
                  name: 'owner-premium',
                  prices: [priceWith({ id: NEW_PRICE_ID, unitAmount: 3_500_000 })]
              }
            : opts.targetPlan;

    const customer = opts.customer === undefined ? UPGRADE_CUSTOMER : opts.customer;
    const checkoutResult =
        opts.checkoutResult === undefined
            ? { id: 'checkout-up-1', providerInitPoint: 'https://mp.test/upgrade-abc' }
            : opts.checkoutResult;

    const planMap = new Map<string, typeof currentPlan>();
    if (currentPlan) planMap.set(currentPlan.id, currentPlan);
    if (targetPlan && targetPlan.id !== currentPlan?.id) planMap.set(targetPlan.id, targetPlan);

    return {
        subscriptions: {
            get: vi.fn().mockResolvedValue(subscription)
        },
        plans: {
            get: vi.fn((id: string) => Promise.resolve(planMap.get(id) ?? null))
        },
        customers: { get: vi.fn().mockResolvedValue(customer) },
        checkout: { create: vi.fn().mockResolvedValue(checkoutResult) }
    };
}

describe('initiatePaidPlanUpgrade', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns checkoutUrl + delta on successful upgrade (half-period remaining)', async () => {
        const billing = createUpgradeBillingMock();

        const result = await initiatePaidPlanUpgrade({
            customerId: CUSTOMER_ID,
            currentSubscriptionId: UPGRADE_SUB_ID,
            newPlanId: NEW_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            billing: billing as any,
            urls: UPGRADE_URLS,
            now: HALFWAY
        });

        expect(result.checkoutUrl).toBe('https://mp.test/upgrade-abc');
        expect(result.localSubscriptionId).toBe(UPGRADE_SUB_ID);
        expect(result.newPlanId).toBe(NEW_PLAN_ID);
        // (3_500_000 - 1_500_000) * 15/30 = 1_000_000 centavos
        expect(result.deltaCentavos).toBe(1_000_000);
        expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('invokes billing.checkout.create with delta line item and full upgrade metadata', async () => {
        const billing = createUpgradeBillingMock();

        await initiatePaidPlanUpgrade({
            customerId: CUSTOMER_ID,
            currentSubscriptionId: UPGRADE_SUB_ID,
            newPlanId: NEW_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            billing: billing as any,
            urls: UPGRADE_URLS,
            statementDescriptor: 'HOSPEDA',
            now: HALFWAY
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.mode).toBe('payment');
        const lineItems = call.lineItems as Array<Record<string, unknown>>;
        expect(lineItems[0]?.unitAmount).toBe(1_000_000); // delta in centavos
        expect(lineItems[0]?.currency).toBe('ARS');
        expect((lineItems[0]?.title as string).toLowerCase()).toContain('upgrade');
        expect(call.successUrl).toBe(UPGRADE_URLS.successUrl);
        expect(call.cancelUrl).toBe(UPGRADE_URLS.cancelUrl);
        expect(call.notificationUrl).toBe(UPGRADE_URLS.notificationUrl);
        expect(call.statementDescriptor).toBe('HOSPEDA');
        expect(call.customerId).toBe(CUSTOMER_ID);
        expect(call.customerEmail).toBe(UPGRADE_CUSTOMER.email);
        expect(call.payerFirstName).toBe('Maria');
        expect(call.payerLastName).toBe('Rodriguez');
        // Idempotency key encodes both the sub and the target plan so a
        // user who retries the SAME upgrade gets the same MP checkout,
        // but a DIFFERENT target plan creates a fresh one.
        expect(call.idempotencyKey).toBe(`${UPGRADE_SUB_ID}:upgrade:${NEW_PLAN_ID}`);
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.planChangeUpgradeId).toBe(UPGRADE_SUB_ID);
        expect(metadata.oldPlanId).toBe(PLAN_ID);
        expect(metadata.newPlanId).toBe(NEW_PLAN_ID);
        expect(metadata.newPriceId).toBe(NEW_PRICE_ID);
        expect(metadata.targetTransactionAmountMajor).toBe(35_000); // 3_500_000 / 100
        expect(metadata.deltaCentavos).toBe(1_000_000);
    });

    it('throws SUBSCRIPTION_NOT_FOUND when the active sub does not exist', async () => {
        const billing = createUpgradeBillingMock({ subscription: null });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: 'missing-sub',
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_FOUND' });
    });

    it('throws SAME_PLAN when newPlanId equals current planId', async () => {
        const billing = createUpgradeBillingMock();

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: PLAN_ID, // same as current
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'SAME_PLAN' });
    });

    it('throws NOT_AN_UPGRADE when delta is zero or negative (downgrade or equal price)', async () => {
        // Target plan price is LOWER → downgrade computes negative delta.
        const billing = createUpgradeBillingMock({
            targetPlan: {
                id: NEW_PLAN_ID,
                name: 'owner-basico-cheaper',
                prices: [priceWith({ id: NEW_PRICE_ID, unitAmount: 500_000 })]
            }
        });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'NOT_AN_UPGRADE' });
    });

    it('throws NO_MATCHING_PRICE when current plan has no price for the interval', async () => {
        const billing = createUpgradeBillingMock({
            currentPlan: {
                id: PLAN_ID,
                name: 'owner-basico',
                prices: [
                    priceWith({ id: 'annual', unitAmount: 15_000_000 }),
                    priceWith({ id: 'm', unitAmount: 1_500_000 })
                ].map((p) => ({ ...p, billingInterval: 'year' })) // both annual — no monthly
            }
        });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'NO_MATCHING_PRICE' });
    });

    it('throws PLAN_NOT_FOUND when target plan does not exist', async () => {
        const billing = createUpgradeBillingMock({ targetPlan: null });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('throws CUSTOMER_NOT_FOUND when the qzpay customer lookup returns null', async () => {
        const billing = createUpgradeBillingMock({ customer: null });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });
    });

    it('throws MISSING_INIT_POINT when checkout returns no URLs', async () => {
        const billing = createUpgradeBillingMock({ checkoutResult: { id: 'empty' } });

        await expect(
            initiatePaidPlanUpgrade({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: UPGRADE_SUB_ID,
                newPlanId: NEW_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                billing: billing as any,
                urls: UPGRADE_URLS,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'MISSING_INIT_POINT' });
    });

    it('falls back to sandbox init point when providerInitPoint is missing', async () => {
        const billing = createUpgradeBillingMock({
            checkoutResult: {
                id: 'sb',
                providerSandboxInitPoint: 'https://sandbox.mp.test/upgrade-xyz'
            }
        });

        const result = await initiatePaidPlanUpgrade({
            customerId: CUSTOMER_ID,
            currentSubscriptionId: UPGRADE_SUB_ID,
            newPlanId: NEW_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            billing: billing as any,
            urls: UPGRADE_URLS,
            now: HALFWAY
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/upgrade-xyz');
    });
});
