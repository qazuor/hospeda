/**
 * Proves the E2E test-control seam is actually wired into the preapproval create
 * (HOS-171).
 *
 * The resilience suite (RES-01, HOST-07c, HOST-07d) arms a failure with
 * `failNext({ operation: 'createSubscription' })` and asserts the checkout fails
 * without leaving an orphan row. That only works if `createPaidSubscription`
 * routes its `billing.subscriptions.create` call through `applyTestControl`.
 *
 * Nothing else catches it if that seam is dropped: with no consumer, `failNext`
 * arms a queue nobody reads, the provider call just succeeds, and the resilience
 * specs fail with a confusing "expected 5xx" rather than "the seam is gone".
 * That is exactly how the previous seam died — its only call sites lived in the
 * publish flow, and removing the no-card trial took them with it, silently.
 *
 * @module test/services/paid-subscription-create.test-control
 */

import { failNext, resetTestControl } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaidSubscription } from '../../src/services/billing/paid-subscription-create.js';

const CUSTOMER_ID = 'cust_resilience';
const OTHER_CUSTOMER_ID = 'cust_other_worker';

const BASE_INPUT = {
    customerId: CUSTOMER_ID,
    planId: 'plan-1',
    priceId: 'price-1',
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/** A provider response complete enough to clear the fail-closed guards. */
function createBillingMock() {
    return {
        subscriptions: {
            create: vi.fn().mockResolvedValue({
                id: 'sub-1',
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_abc' }
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        },
        getStorage: vi.fn(() => ({}))
    };
}

describe('createPaidSubscription — E2E test-control seam', () => {
    beforeEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
        resetTestControl();
    });

    afterEach(() => {
        resetTestControl();
        // Must be '' and not undefined: assigning undefined coerces to the STRING
        // "undefined", which is truthy and would leave the gate looking set.
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = '';
    });

    it('an armed failure reaches the preapproval create and no provider call is made', async () => {
        const billing = createBillingMock();
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'MercadoPago is down'
        });

        await expect(
            createPaidSubscription({ billing: billing as never, ...BASE_INPUT })
        ).rejects.toThrow('MercadoPago is down');

        // The seam fails BEFORE the adapter, so no preapproval is created at all —
        // which is what lets RES-01 assert that a failed attempt leaves no row.
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('the retry after a consumed failure succeeds exactly once', async () => {
        const billing = createBillingMock();
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'MercadoPago is down'
        });

        await expect(
            createPaidSubscription({ billing: billing as never, ...BASE_INPUT })
        ).rejects.toThrow('MercadoPago is down');

        const retry = await createPaidSubscription({ billing: billing as never, ...BASE_INPUT });

        expect(retry.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('a failure scoped to another customer does not touch this checkout', async () => {
        // The E2E workers share one global queue; this is what keeps them from
        // consuming each other's armed failures.
        const billing = createBillingMock();
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'meant for another worker',
            scope: OTHER_CUSTOMER_ID
        });

        const result = await createPaidSubscription({ billing: billing as never, ...BASE_INPUT });

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('an ALREADY-QUEUED failure cannot fire once the gate is off', async () => {
        // Arm while enabled so the entry really lands in the queue, then close the
        // gate and check the seam still passes straight through. This is the
        // module's "even if mounted in production by mistake, every entry no-ops"
        // claim — testing it with the gate closed from the start would only prove
        // that failNext refused to queue, never that applyTestControl ignores what
        // is already queued.
        const billing = createBillingMock();
        failNext({
            operation: 'createSubscription',
            errorCode: 'API_DOWN',
            errorMessage: 'must never fire in production'
        });

        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = '';

        const result = await createPaidSubscription({ billing: billing as never, ...BASE_INPUT });

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });
});
