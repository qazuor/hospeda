/**
 * Unit tests for the `HOSPEDA_SHOW_TEST_BILLING_PLAN` subscribe gate on the
 * hidden daily test plan (`owner-test-daily`, `@repo/billing` `TEST_DAILY_PLAN`).
 *
 * Covers:
 * - `resolvePlanBySlug` (exercised via `_internals`) rejects the slug (returns
 *   `null`, as if the plan does not exist) when the flag is unset/false.
 * - `resolvePlanBySlug` resolves the slug normally when the flag is `true`.
 * - `initiatePaidMonthlySubscription` end-to-end: flag OFF -> throws
 *   `SubscriptionCheckoutError('PLAN_NOT_FOUND')`; flag ON -> succeeds and
 *   forwards the daily price's `priceId` to `subscriptions.create`.
 *
 * `env` is a live binding populated at runtime by `validateApiEnv()` — the
 * override is snapshotted in `beforeEach` and restored in `afterEach` (NOT in
 * the describe body, where it is still undefined during collection). Mirrors
 * the `HOSPEDA_TRIAL_DAYS_OVERRIDE` pattern in `trial.service.test.ts`.
 *
 * @module test/services/subscription-checkout-test-daily-plan
 */

import { TEST_DAILY_PLAN } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _internals,
    initiatePaidMonthlySubscription,
    SubscriptionCheckoutError
} from '../../src/services/subscription-checkout.service';
import { env } from '../../src/utils/env';

const CUSTOMER_ID = 'cust_test_daily';
const PLAN_ID = '00000000-0000-4000-8000-0000000000dd';
const DAILY_PRICE_ID = 'price_daily_1';
const LOCAL_SUB_ID = '22222222-2222-4222-8222-222222222222';

const DAILY_PRICE = {
    id: DAILY_PRICE_ID,
    billingInterval: 'day' as const,
    intervalCount: 1,
    active: true,
    unitAmount: 100,
    currency: 'ARS'
};

const TEST_DAILY_QZPAY_PLAN = {
    id: PLAN_ID,
    name: TEST_DAILY_PLAN.slug,
    prices: [DAILY_PRICE]
};

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

function createBillingMock() {
    return {
        plans: {
            list: vi.fn().mockResolvedValue({ data: [TEST_DAILY_QZPAY_PLAN] })
        },
        subscriptions: {
            create: vi.fn().mockResolvedValue({
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/daily'
            })
        },
        getStorage: vi.fn(() => ({}))
    };
}

describe('HOSPEDA_SHOW_TEST_BILLING_PLAN gate', () => {
    // `env` is a live binding — snapshot/restore in beforeEach/afterEach, not
    // in the describe body (still undefined during collection).
    let originalFlag: typeof env.HOSPEDA_SHOW_TEST_BILLING_PLAN;

    beforeEach(() => {
        originalFlag = env.HOSPEDA_SHOW_TEST_BILLING_PLAN;
        vi.clearAllMocks();
    });

    afterEach(() => {
        env.HOSPEDA_SHOW_TEST_BILLING_PLAN = originalFlag;
    });

    describe('resolvePlanBySlug (_internals)', () => {
        it('returns null for owner-test-daily when the flag is false', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = false;
            const billing = createBillingMock();

            // Act
            const resolved = await _internals.resolvePlanBySlug(
                billing as never,
                TEST_DAILY_PLAN.slug
            );

            // Assert — treated as not-found, same as any unresolvable slug.
            expect(resolved).toBeNull();
            // The gate short-circuits before ever calling plans.list().
            expect(billing.plans.list).not.toHaveBeenCalled();
        });

        it('returns null for owner-test-daily when the flag is unset', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = undefined as unknown as boolean;
            const billing = createBillingMock();

            // Act
            const resolved = await _internals.resolvePlanBySlug(
                billing as never,
                TEST_DAILY_PLAN.slug
            );

            // Assert
            expect(resolved).toBeNull();
        });

        it('resolves owner-test-daily normally when the flag is true', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = true;
            const billing = createBillingMock();

            // Act
            const resolved = await _internals.resolvePlanBySlug(
                billing as never,
                TEST_DAILY_PLAN.slug
            );

            // Assert
            expect(resolved).toEqual(TEST_DAILY_QZPAY_PLAN);
            expect(billing.plans.list).toHaveBeenCalledTimes(1);
        });

        it('never gates a different slug (e.g. owner-premium) regardless of the flag', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = false;
            const otherPlan = { id: 'plan-other', name: 'owner-premium', prices: [] };
            const billing = createBillingMock();
            billing.plans.list.mockResolvedValue({ data: [otherPlan] });

            // Act
            const resolved = await _internals.resolvePlanBySlug(billing as never, 'owner-premium');

            // Assert — unaffected by the test-daily gate.
            expect(resolved).toEqual(otherPlan);
        });
    });

    describe('initiatePaidMonthlySubscription end-to-end', () => {
        it('throws SubscriptionCheckoutError(PLAN_NOT_FOUND) when the flag is false', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = false;
            const billing = createBillingMock();

            // Act
            const attempt = initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: TEST_DAILY_PLAN.slug,
                billing: billing as never,
                urls: URLS
            });

            // Assert
            await expect(attempt).rejects.toBeInstanceOf(SubscriptionCheckoutError);
            await expect(attempt).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });

        it('succeeds and subscribes against the daily priceId when the flag is true', async () => {
            // Arrange
            env.HOSPEDA_SHOW_TEST_BILLING_PLAN = true;
            const billing = createBillingMock();

            // Act
            const result = await initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: TEST_DAILY_PLAN.slug,
                billing: billing as never,
                urls: URLS
            });

            // Assert
            expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
            expect(billing.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    priceId: DAILY_PRICE_ID
                })
            );
        });
    });
});
