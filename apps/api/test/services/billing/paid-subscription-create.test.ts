/**
 * Unit tests for the shared paid-subscription-create helper (HOS-114 T-002).
 *
 * Covers:
 * - Happy path: `subscriptions.create` is called with `mode: 'paid'` +
 *   the passed `priceId` + `paymentMethodReturnUrl`, and the result carries
 *   the live `providerInitPoint` as `checkoutUrl`.
 * - Sandbox fallback: `providerInitPoint` absent, `providerSandboxInitPoint`
 *   present -> `checkoutUrl` resolves to the sandbox URL.
 * - Fail-closed: both init points absent -> throws
 *   `SubscriptionCheckoutError('MISSING_INIT_POINT')` with NO further side
 *   effects (nothing else is called on the billing mock).
 *
 * @module test/services/billing/paid-subscription-create
 */

import { describe, expect, it, vi } from 'vitest';
import { createPaidSubscription } from '../../../src/services/billing/paid-subscription-create';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_monthly_1';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

interface BillingMockOpts {
    subscription?: {
        id: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
        providerSubscriptionIds?: { mercadopago?: string };
    };
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const subscription = opts.subscription ?? {
        id: LOCAL_SUB_ID,
        providerInitPoint: 'https://mp.test/checkout/abc',
        providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc'
    };

    return {
        subscriptions: {
            create: vi.fn().mockResolvedValue(subscription),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    };
}

describe('createPaidSubscription', () => {
    it('returns checkoutUrl + subscription when the provider init point is present', async () => {
        const billing = createBillingMock();

        const result = await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(result.subscription.id).toBe(LOCAL_SUB_ID);
    });

    it('falls back to the sandbox init point when the provider init point is absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz'
            }
        });

        const result = await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/checkout/xyz');
    });

    it('throws SubscriptionCheckoutError(MISSING_INIT_POINT) when both init points are absent, with no further side effects', async () => {
        const billing = createBillingMock({
            subscription: { id: LOCAL_SUB_ID }
        });

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_INIT_POINT'
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('throws a real SubscriptionCheckoutError instance', async () => {
        const billing = createBillingMock({ subscription: { id: LOCAL_SUB_ID } });

        try {
            await createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            });
            expect.unreachable('createPaidSubscription should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(SubscriptionCheckoutError);
        }
    });

    it('calls subscriptions.create with mode:"paid", the passed priceId, and paymentMethodReturnUrl', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            freeTrialDays: 7,
            metadata: { source: 'unit-test' }
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            mode: 'paid',
            billingInterval: 'monthly',
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl,
            freeTrialDays: 7,
            metadata: { source: 'unit-test' }
        });
    });

    it('omits freeTrialDays and metadata from the create payload when not supplied', async () => {
        const billing = createBillingMock();

        await createPaidSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
            notificationUrl: URLS.notificationUrl
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).not.toHaveProperty('freeTrialDays');
        expect(call).not.toHaveProperty('metadata');
    });
});
