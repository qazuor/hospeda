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
import {
    PENDING_PROVIDER_TTL_MS,
    SubscriptionCheckoutError,
    computePlanChangeDelta,
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription,
    initiatePaidPlanUpgrade
} from '../../src/services/subscription-checkout.service';

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

function createPlan(prices: PriceFixture[]) {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices
    };
}

interface BillingMockOpts {
    plans?: ReturnType<typeof createPlan>[];
    subscription?: {
        id: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
    } | null;
    createThrows?: Error;
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const plans = opts.plans ?? [createPlan([MONTHLY_PRICE, ANNUAL_PRICE])];
    const subscription =
        opts.subscription === undefined
            ? {
                  id: LOCAL_SUB_ID,
                  providerInitPoint: 'https://mp.test/checkout/abc',
                  providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc'
              }
            : opts.subscription;

    const create = opts.createThrows
        ? vi.fn().mockRejectedValue(opts.createThrows)
        : vi.fn().mockResolvedValue(subscription);

    return {
        plans: {
            list: vi.fn().mockResolvedValue({ data: plans })
        },
        subscriptions: {
            create
        },
        // SPEC-143: schedulePollingForSubscription helper guards on
        // `getStorage().subscriptionPollingJobs` being present. These
        // tests do not exercise polling — returning a storage without
        // the polling slot makes the helper short-circuit cleanly.
        getStorage: vi.fn(() => ({}))
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

describe('initiatePaidMonthlySubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns checkoutUrl, localSubscriptionId, and expiresAt on success', async () => {
        const billing = createBillingMock();
        const before = Date.now();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        const after = Date.now();

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);

        const expiresAtMs = new Date(result.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + PENDING_PROVIDER_TTL_MS - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + PENDING_PROVIDER_TTL_MS + 2000);
    });

    it('invokes billing.subscriptions.create with the right arguments', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: MONTHLY_PRICE_ID,
            mode: 'paid',
            billingInterval: 'monthly',
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('start-paid-monthly');
    });

    it('falls back to the sandbox init point when provider init point is absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz'
            }
        });

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/checkout/xyz');
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

    it('throws MISSING_INIT_POINT when qzpay returns a sub without any init point', async () => {
        const billing = createBillingMock({
            subscription: { id: LOCAL_SUB_ID }
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
            code: 'MISSING_INIT_POINT'
        });
    });

    it('does not catch unrelated errors thrown by qzpay (they propagate)', async () => {
        const billing = createBillingMock({
            createThrows: new Error('Network down')
        });

        await expect(
            initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: URLS
            })
        ).rejects.toThrow('Network down');
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
    // SPEC-126 D9: free-trial extension promo handling
    // -----------------------------------------------------------------------

    it('forwards freeTrialDays to qzpay when FREEMONTH is supplied', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'FREEMONTH'
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.freeTrialDays).toBe(30);
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.promoCode).toBe('FREEMONTH');
    });

    it('does NOT set freeTrialDays when no promo code is supplied', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.freeTrialDays).toBeUndefined();
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.promoCode).toBeUndefined();
    });

    it('treats the promo code case-insensitively (lowercase resolves)', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            promoCode: 'freemonth'
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.freeTrialDays).toBe(30);
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

        // qzpay was NOT called — fast-fail before the create.
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
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

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.freeTrialDays).toBeUndefined();
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

interface CustomerFixture {
    id: string;
    email: string;
    name: string | null;
    livemode: boolean;
}

const CUSTOMER_FIXTURE: CustomerFixture = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

const ANNUAL_PRICE_WITH_AMOUNT = {
    id: ANNUAL_PRICE_ID,
    billingInterval: 'year' as const,
    intervalCount: 1,
    active: true,
    unitAmount: 35_000_000
};

function createAnnualBillingMock(
    opts: {
        plans?: Array<{ id: string; name: string; prices: unknown[] }>;
        customer?: CustomerFixture | null;
        checkoutResult?: {
            id?: string;
            providerInitPoint?: string;
            providerSandboxInitPoint?: string;
        } | null;
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
    const checkoutResult =
        opts.checkoutResult === undefined
            ? { id: 'checkout-1', providerInitPoint: 'https://mp.test/checkout/annual-abc' }
            : opts.checkoutResult;

    return {
        plans: { list: vi.fn().mockResolvedValue({ data: plans }) },
        customers: { get: vi.fn().mockResolvedValue(customer) },
        checkout: { create: vi.fn().mockResolvedValue(checkoutResult) },
        // SPEC-143 polling enqueue happens inside the annual flow now —
        // empty storage makes the helper short-circuit cleanly.
        getStorage: vi.fn(() => ({}))
    };
}

function makeStubDb() {
    const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const stub = {
        insert(table: unknown) {
            return {
                values(values: Record<string, unknown>) {
                    insertCalls.push({ table, values });
                    return Promise.resolve(undefined);
                }
            };
        }
    };
    return {
        stub: stub as unknown as Parameters<typeof initiatePaidAnnualSubscription>[0]['db'],
        insertCalls
    };
}

describe('initiatePaidAnnualSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns checkoutUrl, localSubscriptionId, and expiresAt on success', async () => {
        const billing = createAnnualBillingMock();
        const { stub, insertCalls } = makeStubDb();
        const before = Date.now();

        const result = await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS,
            db: stub
        });

        const after = Date.now();

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/annual-abc');
        expect(typeof result.localSubscriptionId).toBe('string');
        expect(result.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/i);

        const expiresAtMs = new Date(result.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + PENDING_PROVIDER_TTL_MS - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + PENDING_PROVIDER_TTL_MS + 2000);

        // Local sub row inserted with annual lifecycle fields.
        expect(insertCalls).toHaveLength(1);
        const subRow = insertCalls[0]?.values as Record<string, unknown>;
        expect(subRow.customerId).toBe(CUSTOMER_ID);
        expect(subRow.planId).toBe(PLAN_ID);
        expect(subRow.billingInterval).toBe('year');
        expect(subRow.intervalCount).toBe(1);
        expect(subRow.status).toBe('pending_provider');
        expect(subRow.livemode).toBe(false);
        const subStart = subRow.currentPeriodStart as Date;
        const subEnd = subRow.currentPeriodEnd as Date;
        expect(subEnd.getTime() - subStart.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
        const metadata = subRow.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('start-paid-annual');
        expect(metadata.billingInterval).toBe('annual');
        expect(metadata.planSlug).toBe('owner-premium');
        expect(metadata.annualPriceId).toBe(ANNUAL_PRICE_ID);
    });

    it('invokes billing.checkout.create with one-time payment mode and correct line item', async () => {
        const billing = createAnnualBillingMock();
        const { stub } = makeStubDb();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS,
            db: stub
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.mode).toBe('payment');
        const lineItems = call.lineItems as Array<Record<string, unknown>>;
        expect(lineItems).toHaveLength(1);
        expect(lineItems[0]).toMatchObject({
            unitAmount: 35_000_000,
            currency: 'ARS',
            quantity: 1,
            categoryId: 'services'
        });
        expect((lineItems[0]?.title as string).toLowerCase()).toContain('annual');
        expect(call.successUrl).toBe(ANNUAL_URLS.successUrl);
        expect(call.cancelUrl).toBe(ANNUAL_URLS.cancelUrl);
        expect(call.customerId).toBe(CUSTOMER_ID);
        expect(call.customerEmail).toBe(CUSTOMER_FIXTURE.email);
        expect(call.customerName).toBe('Maria Rodriguez');
        expect(call.payerFirstName).toBe('Maria');
        expect(call.payerLastName).toBe('Rodriguez');
        expect(call.notificationUrl).toBe(ANNUAL_URLS.notificationUrl);
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.billingInterval).toBe('annual');
        expect(metadata.planSlug).toBe('owner-premium');
        expect(typeof metadata.annualSubscriptionId).toBe('string');
        expect(call.idempotencyKey).toBe(metadata.annualSubscriptionId);
    });

    it('falls back to sandbox init point when providerInitPoint is missing', async () => {
        const billing = createAnnualBillingMock({
            checkoutResult: {
                id: 'checkout-2',
                providerSandboxInitPoint: 'https://sandbox.mp.test/annual-xyz'
            }
        });
        const { stub } = makeStubDb();

        const result = await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS,
            db: stub
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/annual-xyz');
    });

    it('forwards statementDescriptor when provided', async () => {
        const billing = createAnnualBillingMock();
        const { stub } = makeStubDb();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS,
            statementDescriptor: 'HOSPEDA',
            db: stub
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.statementDescriptor).toBe('HOSPEDA');
    });

    it('omits payerFirstName/payerLastName when customer has no name', async () => {
        const billing = createAnnualBillingMock({
            customer: { ...CUSTOMER_FIXTURE, name: null }
        });
        const { stub } = makeStubDb();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: ANNUAL_URLS,
            db: stub
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.customerName).toBeUndefined();
        expect(call.payerFirstName).toBeUndefined();
        expect(call.payerLastName).toBeUndefined();
    });

    it('throws PLAN_NOT_FOUND when the slug is unknown', async () => {
        const billing = createAnnualBillingMock({ plans: [] });
        const { stub } = makeStubDb();

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'does-not-exist',
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
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
        const { stub } = makeStubDb();

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
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
        const { stub } = makeStubDb();

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
            })
        ).rejects.toMatchObject({ code: 'NO_ANNUAL_PRICE' });
    });

    it('throws CUSTOMER_NOT_FOUND when billing.customers.get returns null', async () => {
        const billing = createAnnualBillingMock({ customer: null });
        const { stub } = makeStubDb();

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
            })
        ).rejects.toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });
    });

    it('throws MISSING_INIT_POINT when checkout returns no URLs', async () => {
        const billing = createAnnualBillingMock({
            checkoutResult: { id: 'checkout-empty' }
        });
        const { stub } = makeStubDb();

        await expect(
            initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
            })
        ).rejects.toMatchObject({ code: 'MISSING_INIT_POINT' });
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
