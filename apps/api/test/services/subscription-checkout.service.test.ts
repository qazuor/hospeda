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
});
