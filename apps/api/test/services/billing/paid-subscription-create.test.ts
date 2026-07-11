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
        providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc',
        // HOS-151 Bug C: a valid paid preapproval always carries a provider
        // subscription id — the helper now rejects a response without one.
        providerSubscriptionIds: { mercadopago: 'mp_preapproval_abc' }
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
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_xyz' }
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

    // ── HOS-151 Bug C: reject an id-less MP preapproval ───────────────────────
    // MP can return a 2xx preapproval with no provider subscription id. Before
    // the fix this persisted a live `incomplete` row with `mp_subscription_id =
    // ''` that could never activate (webhook lookup keys on the id) and whose
    // preapproval could never be located to cancel. The helper must now fail
    // loudly with MISSING_PROVIDER_SUBSCRIPTION_ID after cleaning up the row.

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID and cancels the row when the provider id is an empty string', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
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
            code: 'MISSING_PROVIDER_SUBSCRIPTION_ID'
        });

        // The just-created local row is cancelled (fail-closed) so no unlinkable
        // `incomplete` row survives.
        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
        expect(billing.subscriptions.cancel).toHaveBeenCalledWith(LOCAL_SUB_ID);
    });

    it('throws MISSING_PROVIDER_SUBSCRIPTION_ID when providerSubscriptionIds is entirely absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc'
                // no providerSubscriptionIds at all
            }
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
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
    });

    it('still throws MISSING_PROVIDER_SUBSCRIPTION_ID when the best-effort cleanup cancel itself fails', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: '' }
            }
        });
        // The cleanup cancel fails — the abandoned-pending cron is the backstop;
        // the original id-less error must still surface (cleanup is best-effort).
        billing.subscriptions.cancel.mockRejectedValueOnce(new Error('MP unreachable'));

        await expect(
            createPaidSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: PRICE_ID,
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        ).rejects.toMatchObject({ code: 'MISSING_PROVIDER_SUBSCRIPTION_ID' });

        expect(billing.subscriptions.cancel).toHaveBeenCalledTimes(1);
    });

    it('does NOT reach the provider-id guard when the checkout URL is missing (MISSING_INIT_POINT wins first)', async () => {
        // A response missing BOTH the init point and the provider id fails at the
        // init-point guard first, with no cleanup cancel — preserving the
        // pre-existing MISSING_INIT_POINT contract.
        const billing = createBillingMock({
            subscription: { id: LOCAL_SUB_ID, providerSubscriptionIds: { mercadopago: '' } }
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
        ).rejects.toMatchObject({ code: 'MISSING_INIT_POINT' });

        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });
});
