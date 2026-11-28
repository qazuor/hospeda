/**
 * HOS-2179 T-6: the return re-read (§5.3 path 2) and the A1 answer for a purchase released
 * before its page opened. The fake lies by default; no lie is switched off here.
 */
import { addonInstances, eq, payments } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { readAddonPurchase } from '../../../src/services/billing/addon/read-addon-purchase';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { boughtPage, pageSetup, retirePageMarks } from './support/one-time-page-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

async function setupBought() {
    const s = await pageSetup();
    const bought = await boughtPage(s);
    const identity = { ownerId: s.request.ownerId, orderRequestId: s.request.orderRequestId };
    return { s, ...bought, identity };
}

describe('HOS-2179 §5.3 path 2: the return re-read confirms a page purchase by id', () => {
    it.skipIf(skip)(
        'stays waiting when the provider holds no approved payment (AC-7)',
        async () => {
            const { s, identity, instance } = await setupBought();
            const search = vi.spyOn(s.f.fake, 'searchCharges');
            const read = await readAddonPurchase(identity, s.ports);
            expect(read).toEqual({
                instanceId: instance.id,
                status: 'PENDING_AUTHORIZATION',
                chargeKind: 'UNA_VEZ',
                processing: true,
                // HOS-2680: the purchase identity, so the screen can ask for it again.
                productId: s.request.productId,
                targetId: s.request.targetId,
                addonVersionId: s.request.expectedAddonVersionId
            });
            expect(search).toHaveBeenCalledTimes(1);
            expect(search.mock.calls[0]?.[0]).toMatchObject({
                reference: s.request.orderRequestId
            });
        }
    );

    it.skipIf(skip)(
        'activates on an approved payment re-read by id and answers ACTIVE (AC-6)',
        async () => {
            const { s, identity, instance, paymentPageId } = await setupBought();
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            const readCharge = vi.spyOn(s.f.fake, 'readCharge');
            const read = await readAddonPurchase(identity, s.ports);
            expect(read).toMatchObject({ status: 'ACTIVE', processing: false });
            expect(readCharge).toHaveBeenCalledWith(
                expect.objectContaining({ chargeId: paid.chargeId })
            );
            const attached = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.addonInstanceId, instance.id));
            expect(attached).toHaveLength(1);
            expect(attached[0]?.status).toBe('SUCCEEDED');
        }
    );

    it.skipIf(skip)(
        'keeps waiting after a rejected payment, so the owner can retry (AC-9)',
        async () => {
            const { s, identity, paymentPageId } = await setupBought();
            s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
            expect(await readAddonPurchase(identity, s.ports)).toMatchObject({
                status: 'PENDING_AUTHORIZATION',
                processing: true
            });
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            expect(await readAddonPurchase(identity, s.ports)).toMatchObject({ status: 'ACTIVE' });
        }
    );

    it.skipIf(skip)('never asks the provider without ports', async () => {
        const { s, identity, paymentPageId } = await setupBought();
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        expect(await readAddonPurchase(identity)).toMatchObject({
            status: 'PENDING_AUTHORIZATION'
        });
        expect(search).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('answers the stored state when the search does not answer', async () => {
        const { s, identity } = await setupBought();
        vi.spyOn(s.f.fake, 'searchCharges').mockRejectedValueOnce(
            new PaymentProviderError({ code: 'UNAVAILABLE', capability: 'read', message: 'down' })
        );
        expect(await readAddonPurchase(identity, s.ports)).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            processing: true
        });
    });

    it.skipIf(skip)('answers the stored state when the re-read itself throws', async () => {
        const { s, identity, paymentPageId } = await setupBought();
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        // An id A2 refuses to parse makes the confirmation itself throw, past its own catch.
        vi.spyOn(s.f.fake, 'searchCharges').mockResolvedValueOnce({ chargeIds: [''] });
        expect(await readAddonPurchase(identity, s.ports)).toMatchObject({
            status: 'PENDING_AUTHORIZATION'
        });
    });

    it.skipIf(skip)("reads another owner's purchase as absent and asks nobody", async () => {
        const { s, identity } = await setupBought();
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        expect(
            await readAddonPurchase({ ...identity, ownerId: crypto.randomUUID() }, s.ports)
        ).toBeNull();
        expect(search).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('does not search for a page purchase whose page never opened', async () => {
        const s = await pageSetup();
        vi.spyOn(s.f.fake, 'requestOneTimePayment').mockRejectedValueOnce(
            new PaymentProviderError({ code: 'UNAVAILABLE', capability: 'charge', message: 'lost' })
        );
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toThrow();
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        expect(
            await readAddonPurchase(
                { ownerId: s.request.ownerId, orderRequestId: s.request.orderRequestId },
                s.ports
            )
        ).toMatchObject({ status: 'PENDING_AUTHORIZATION' });
        expect(search).not.toHaveBeenCalled();
    });
});

describe('HOS-2179 T-6: A1 when the page could not be recorded', () => {
    it.skipIf(skip)(
        'answers a purchase activated while its page was in flight as is, not abandoned',
        async () => {
            const s = await pageSetup();
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
                const page = await original(input);
                await getServiceTestDb()
                    .update(addonInstances)
                    .set({
                        status: 'ACTIVE',
                        startsAt: s.f.ports.clock.now(),
                        endsAt: new Date(s.f.ports.clock.now().getTime() + 7 * 86_400_000)
                    })
                    .where(eq(addonInstances.orderRequestId, input.reference));
                return page;
            });
            const result = await purchaseAddon(s.request, s.f.ports);
            expect(result).toMatchObject({ outcome: 'CREATED', chargeKind: 'UNA_VEZ' });
            expect('checkoutUrl' in result && result.checkoutUrl).toBeFalsy();
        }
    );
});
