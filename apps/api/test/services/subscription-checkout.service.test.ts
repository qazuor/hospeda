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
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
        checkout: { create: vi.fn().mockResolvedValue(checkoutResult) }
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
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
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                urls: ANNUAL_URLS,
                db: stub
            })
        ).rejects.toMatchObject({ code: 'MISSING_INIT_POINT' });
    });
});
