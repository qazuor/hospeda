/**
 * HOS-2179 T-6 review: an owner who came back from the payment page without paying and asks
 * again (a fresh order id, the same owner, product and target) gets a page to pay, never a
 * "pending elsewhere" answer for a payment that does not exist. The fake lies by default.
 */
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    pageInstance,
    pageSetup,
    retirePageMarks
} from './support/one-time-page-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

async function boughtAndBack() {
    const s = await pageSetup();
    const bought = await boughtPage(s);
    const retry = { ...s.request, orderRequestId: crypto.randomUUID() };
    return { s, ...bought, retry };
}

describe('HOS-2179 T-6 review: a retry over the same owner pending page purchase', () => {
    it.skipIf(skip)('answers the open page link to pay it, opening no second page', async () => {
        const { s, instance, retry } = await boughtAndBack();
        const page = vi.spyOn(s.f.fake, 'requestOneTimePayment');
        const answer = await purchaseAddon(retry, s.f.ports);
        expect(answer).toEqual({
            outcome: 'EXISTING',
            instanceId: instance.id,
            chargeKind: 'UNA_VEZ',
            checkoutUrl: expect.stringMatching(/^https:\/\//)
        });
        expect(page).not.toHaveBeenCalled();
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)(
        'releases a page that stopped taking payments with none approved and opens a new one',
        async () => {
            const { s, instance, retry } = await boughtAndBack();
            if (!instance.paymentPageExpiresAt) throw new Error('Page expiry missing');
            s.f.advanceTo(new Date(instance.paymentPageExpiresAt.getTime() + 1));
            const search = vi.spyOn(s.f.fake, 'searchCharges');
            const answer = await purchaseAddon(retry, s.f.ports);
            expect(answer).toMatchObject({
                outcome: 'CREATED',
                chargeKind: 'UNA_VEZ',
                checkoutUrl: expect.stringMatching(/^https:\/\//)
            });
            if (answer.outcome !== 'CREATED') throw new Error(answer.outcome);
            expect(answer.instanceId).not.toBe(instance.id);
            expect(search).toHaveBeenCalledWith(
                expect.objectContaining({ reference: s.request.orderRequestId })
            );
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
            expect((await pageInstance(answer.instanceId)).paymentPageId).not.toBeNull();
        }
    );

    it.skipIf(skip)(
        'activates an expired page that holds an approved payment and answers it as active',
        async () => {
            const { s, instance, paymentPageId, retry } = await boughtAndBack();
            if (!instance.paymentPageExpiresAt) throw new Error('Page expiry missing');
            // Paid in time, but the notice never came (M6): only the search finds it.
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            s.f.advanceTo(new Date(instance.paymentPageExpiresAt.getTime() + 1));
            const answer = await purchaseAddon(retry, s.f.ports);
            expect(answer).toEqual({ outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' });
            expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        }
    );

    it.skipIf(skip)(
        'decides nothing about an expired page when the search does not answer',
        async () => {
            const { s, instance, retry } = await boughtAndBack();
            if (!instance.paymentPageExpiresAt) throw new Error('Page expiry missing');
            s.f.advanceTo(new Date(instance.paymentPageExpiresAt.getTime() + 1));
            vi.spyOn(s.f.fake, 'searchCharges').mockRejectedValueOnce(new Error('down'));
            const attempt = purchaseAddon(retry, s.f.ports);
            await expect(attempt).rejects.toBeInstanceOf(PaymentProviderError);
            await expect(attempt).rejects.toMatchObject({ transient: { kind: 'UNAVAILABLE' } });
            expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        }
    );

    it.skipIf(skip)(
        "shares nothing with another owner's pending page purchase of the same product",
        async () => {
            const { s, instance } = await boughtAndBack();
            const other = await purchaseFixture();
            await payingPrincipal(other);
            const answer = await purchaseAddon(
                {
                    ...other.input(),
                    productId: s.request.productId,
                    expectedAddonVersionId: s.request.expectedAddonVersionId
                },
                s.f.ports
            );
            expect(answer).toMatchObject({ outcome: 'CREATED', chargeKind: 'UNA_VEZ' });
            if (answer.outcome !== 'CREATED') throw new Error(answer.outcome);
            expect(answer.instanceId).not.toBe(instance.id);
            const first = await pageInstance(instance.id);
            const second = await pageInstance(answer.instanceId);
            expect(second.ownerId).toBe(other.ownerId);
            expect(second.paymentPageId).not.toBe(first.paymentPageId);
            expect(first.status).toBe('PENDING_AUTHORIZATION');
        }
    );

    it.skipIf(skip)('a one-time purchase is always paid on a page', async () => {
        const s = await pageSetup();
        const page = vi.spyOn(s.f.fake, 'requestOneTimePayment');
        const answer = await purchaseAddon(s.request, s.f.ports);
        expect(answer).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
        expect(page).toHaveBeenCalledTimes(1);
    });
});
