import { addonInstances, eq } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { createProduct, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    activationPagePayments,
    boughtPage,
    heldPagePayments,
    pageInstance,
    pageMarks,
    pagePayments,
    pagePriceIs,
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

type Setup = Awaited<ReturnType<typeof pageSetup>>;

/** The receiver's ports as the API wires them: the complement policy readers included. */
function receiverPorts(s: Setup, input: { readonly complements?: boolean } = {}) {
    return {
        provider: s.f.fake,
        clock: s.f.ports.clock,
        beforeCancelNotice: s.ports.beforeCancelNotice,
        coverageNotices: s.ports.coverageNotices,
        ...(input.complements === false
            ? {}
            : {
                  complements: {
                      addonPolicy: s.f.ports.addonPolicy,
                      listing: s.f.ports.listing
                  }
              })
    };
}

/** The URL a delivery arrives at: Webhooks for the primary channel, IPN for the second. */
function urlOf(delivery: NoticeDelivery): string {
    return delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] === 'secondary'
        ? 'https://api.example.test/api/v1/webhooks/mercadopago?topic=payment'
        : 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks';
}

/** Hands one delivery to the receiver. */
async function deliver(s: Setup, delivery: NoticeDelivery, input?: { complements?: boolean }) {
    return receiveProviderDelivery({ url: urlOf(delivery), delivery }, receiverPorts(s, input));
}

/** The Webhooks deliveries the fake sent and that are due (M6 also sends each by IPN). */
function webhooksDeliveries(s: Setup): NoticeDelivery[] {
    return s.f.fake
        .takeDeliveries()
        .deliveries.filter((d) => d.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary');
}

describe('HOS-2179 §5.3 path 1: the payment notice of a page purchase reaches A2', () => {
    it.skipIf(skip)('activates only after re-reading the payment by id (AC-6)', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const all = s.f.fake.takeDeliveries().deliveries;
        // M6 is on: the charge notice arrives once per channel.
        expect(all).toHaveLength(2);
        const read = vi.spyOn(s.f.fake, 'readCharge');

        const results = [];
        for (const delivery of all) results.push(await deliver(s, delivery));

        expect(results.map((r) => r.outcome).sort()).toEqual([
            'ADDON_PAYMENT_ACTIVATED',
            'IPN_NOT_PROCESSED'
        ]);
        expect(results.every((r) => r.ack === 'OK')).toBe(true);
        expect(read).toHaveBeenCalledWith({ chargeId: paid.chargeId });
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        expect((await pagePayments(instance.id)).map((p) => p.providerFactId)).toEqual([
            paid.chargeId
        ]);
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('answers a repeated notice without a second payment or a mark', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');

        expect((await deliver(s, notice)).outcome).toBe('ADDON_PAYMENT_ACTIVATED');
        expect(await deliver(s, notice)).toEqual({
            ack: 'OK',
            outcome: 'ADDON_PAYMENT_ALREADY_CONFIRMED'
        });
        expect(await pagePayments(instance.id)).toHaveLength(1);
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'converges on one activation and one duplicate mark whatever the notice order',
        async () => {
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            // Out of order: the newer payment's notice arrives first.
            const notices = webhooksDeliveries(s).reverse();
            expect(notices).toHaveLength(2);

            const outcomes = [];
            for (const notice of notices) outcomes.push((await deliver(s, notice)).outcome);

            expect(outcomes).toEqual(['ADDON_PAYMENT_ACTIVATED', 'ADDON_DUPLICATE_PAYMENT_MARKED']);
            expect(
                (await activationPagePayments(instance.id)).map((p) => p.providerFactId)
            ).toEqual([second.chargeId]);
            expect(
                (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
            ).toEqual([first.chargeId]);
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'COBRO_DUPLICADO', liftedAt: null }
            ]);
            expect(first.chargeId).not.toBe(second.chargeId);
        }
    );

    it.skipIf(skip)('keeps waiting on a rejected payment, in either order (AC-9)', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        const [rejected] = webhooksDeliveries(s);
        if (!rejected) throw new Error('notice missing');
        expect((await deliver(s, rejected)).outcome).toBe('ADDON_PAYMENT_NOT_APPROVED');
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');

        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [approved] = webhooksDeliveries(s);
        if (!approved) throw new Error('notice missing');
        expect((await deliver(s, approved)).outcome).toBe('ADDON_PAYMENT_ACTIVATED');
        // The rejected notice arriving again after the activation changes nothing.
        expect((await deliver(s, rejected)).outcome).toBe('ADDON_PAYMENT_NOT_APPROVED');
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'opens mark 23 for a payment notice after the purchase closed (AC-12)',
        async () => {
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await abandonOneTimeAddon({
                instanceId: instance.id,
                expectedProviderOrderId: null,
                now: s.f.ports.clock.now()
            });
            const [late] = webhooksDeliveries(s);
            if (!late) throw new Error('notice missing');

            expect(await deliver(s, late)).toEqual({
                ack: 'OK',
                outcome: 'ADDON_LATE_PAYMENT_MARKED'
            });
            expect(await deliver(s, late)).toEqual({
                ack: 'OK',
                outcome: 'ADDON_LATE_PAYMENT_MARKED'
            });
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
            expect(await activationPagePayments(instance.id)).toHaveLength(0);
            expect(await heldPagePayments(instance.id)).toHaveLength(1);
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'ORDEN_PAGADA_SIN_INSTANCIA', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)('opens the amount divergence for another amount (AC-8)', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await pagePriceIs(instance.productId, 12000);
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');
        expect((await deliver(s, notice)).outcome).toBe('ADDON_AMOUNT_DIVERGENCE_MARKED');
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await pageMarks(instance.id)).toEqual([
            { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
        ]);
    });

    it.skipIf(skip)('answers UNKNOWN_RESOURCE for a reference no purchase carries', async () => {
        const s = await pageSetup();
        const stray = await s.f.fake.requestOneTimePayment({
            reference: crypto.randomUUID(),
            idempotencyKey: `page:${crypto.randomUUID()}`,
            amount: { amountMinor: 10000, currency: 'ARS' },
            reason: 'Not ours',
            returnUrl: 'https://example.test/return',
            expiresAt: new Date(s.f.ports.clock.now().getTime() + 3_600_000).toISOString()
        });
        s.f.fake.takeDeliveries();
        s.f.fake.payOnPage({ paymentPageId: stray.paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');
        expect(await deliver(s, notice)).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
    });

    it.skipIf(skip)('leaves an order purchase on the order path', async () => {
        const s = await pageSetup();
        const orderRequest = { ...s.request, oneTimeChannel: 'ORDER' as const };
        const order = await purchaseAddon(orderRequest, s.f.ports);
        if (order.outcome !== 'CREATED') throw new Error(order.outcome);
        // A payment carrying the order purchase's reference, with no authorization.
        const page = await s.f.fake.requestOneTimePayment({
            reference: orderRequest.orderRequestId,
            idempotencyKey: `page:${orderRequest.orderRequestId}`,
            amount: { amountMinor: 10000, currency: 'ARS' },
            reason: 'Order purchase reference',
            returnUrl: 'https://example.test/return',
            expiresAt: new Date(s.f.ports.clock.now().getTime() + 3_600_000).toISOString()
        });
        s.f.fake.takeDeliveries();
        s.f.fake.payOnPage({ paymentPageId: page.paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');
        expect(await deliver(s, notice)).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
        expect(await pagePayments(order.instanceId)).toHaveLength(0);
        expect(await pageMarks(order.instanceId)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'acks an error when the re-read does not answer, and recovers on redelivery',
        async () => {
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            const [notice] = webhooksDeliveries(s);
            if (!notice) throw new Error('notice missing');
            const original = s.f.fake.readCharge.bind(s.f.fake);
            // The receiver's routing read answers; A2's own re-read by id does not.
            vi.spyOn(s.f.fake, 'readCharge')
                .mockImplementationOnce(original)
                .mockRejectedValueOnce(new Error('provider down'));

            expect(await deliver(s, notice)).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');

            expect((await deliver(s, notice)).outcome).toBe('ADDON_PAYMENT_ACTIVATED');
        }
    );

    it.skipIf(skip)('acks an error instead of dropping the notice when A2 is unwired', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');
        expect(await deliver(s, notice, { complements: false })).toEqual({
            ack: 'ERROR',
            outcome: 'FAILED'
        });
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)('decides on A2 own re-read, not on the routing read', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');
        const original = s.f.fake.readCharge.bind(s.f.fake);
        // The routing read saw a loose charge; A2's re-read finds it under an authorization.
        vi.spyOn(s.f.fake, 'readCharge')
            .mockImplementationOnce(original)
            .mockImplementationOnce(async (ref) => {
                const read = await original(ref);
                return { ...read, snapshot: { ...read.snapshot, authorizationId: 'auth-1' } };
            });

        expect(await deliver(s, notice)).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await pagePayments(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('leaves a page reference of a periodic product on the old path', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const periodic = await createProduct({
            scopeType: 'USER',
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            verticals: ['accommodation']
        });
        await getServiceTestDb()
            .update(addonInstances)
            .set({ productId: periodic.productId })
            .where(eq(addonInstances.id, instance.id));
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');

        expect(await deliver(s, notice)).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('acks an error when A2 finds the page purchase is not one', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        // A page purchase never carries an order id: A2 answers NOT_APPLICABLE.
        await getServiceTestDb()
            .update(addonInstances)
            .set({ providerOrderId: `order-${crypto.randomUUID()}` })
            .where(eq(addonInstances.id, instance.id));
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const [notice] = webhooksDeliveries(s);
        if (!notice) throw new Error('notice missing');

        expect(await deliver(s, notice)).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });
});
