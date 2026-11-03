import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });
const money = (amountMinor: number) => ({ amountMinor, currency: 'ARS' });

function setup(paid = true) {
    const fake = new FakePaymentProvider({ clock });
    const { orderId } = fake.placeOrder({ reference: 'purchase', paid, amount: money(10_000) });
    return { fake, orderId };
}

async function partial(
    fake: FakePaymentProvider,
    orderId: string,
    reference: string,
    amountMinor: number
) {
    const { snapshot } = await fake.readOrder({ orderId });
    return fake.refundOrder({
        orderId,
        reference,
        scope: {
            kind: 'partial',
            transactionId: snapshot.paymentTransactionId ?? '',
            amount: money(amountMinor)
        }
    });
}

describe('HOS-1553 AC:B6:8 TEST:B6:6 fake order refunds', () => {
    it('returns one partial then the remaining balance on total', async () => {
        const { fake, orderId } = setup();
        const first = await partial(fake, orderId, 'key-1', 2500);
        const second = await fake.refundOrder({
            orderId,
            reference: 'key-2',
            scope: { kind: 'total' }
        });
        expect(first.refunds).toHaveLength(1);
        expect(second.refunds.map((refund) => refund.amountMinor)).toStrictEqual([2500, 7500]);
        expect((await fake.readOrder({ orderId })).snapshot.refunds).toStrictEqual(second.refunds);
    });

    it('replays the first response photo without adding a refund', async () => {
        const { fake, orderId } = setup();
        const first = await partial(fake, orderId, 'same', 2500);
        const replay = await partial(fake, orderId, 'same', 2500);
        expect(replay).toStrictEqual(first);
        expect((await fake.readOrder({ orderId })).snapshot.refunds).toHaveLength(1);
    });

    it('rejects the same key with a changed body and preserves the refund count', async () => {
        const { fake, orderId } = setup();
        await partial(fake, orderId, 'same', 2500);
        await expect(partial(fake, orderId, 'same', 3000)).rejects.toMatchObject({
            code: 'REJECTED',
            refundRefusal: 'KEY_REUSED'
        });
        expect((await fake.readOrder({ orderId })).snapshot.refunds).toHaveLength(1);
    });

    it('rejects excess, foreign transaction, unpaid order and missing order', async () => {
        const { fake, orderId } = setup();
        await expect(partial(fake, orderId, 'excess', 10_001)).rejects.toMatchObject({
            code: 'REJECTED'
        });
        await expect(
            fake.refundOrder({
                orderId,
                reference: 'foreign',
                scope: { kind: 'partial', transactionId: 'OTHER', amount: money(100) }
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        const unpaid = fake.placeOrder({ reference: 'unpaid', paid: false });
        await expect(
            fake.refundOrder({
                orderId: unpaid.orderId,
                reference: 'unpaid',
                scope: { kind: 'total' }
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        await expect(
            fake.refundOrder({ orderId: 'missing', reference: 'missing', scope: { kind: 'total' } })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('holds only the named accredited refund', async () => {
        const { fake, orderId } = setup();
        const first = await partial(fake, orderId, 'first', 2500);
        const second = await partial(fake, orderId, 'second', 1000);
        fake.holdOrderRefund({ orderId, refundId: first.refunds[0]?.refundId ?? '' });
        expect((await fake.readOrder({ orderId })).snapshot.refunds).toStrictEqual([
            { ...first.refunds[0], accredited: false },
            second.refunds[1]
        ]);
        expect(() => fake.holdOrderRefund({ orderId, refundId: 'other' })).toThrow();
        expect(() =>
            fake.holdOrderRefund({ orderId, refundId: first.refunds[0]?.refundId ?? '' })
        ).toThrow();
    });

    it('applies lostResponse after the refund and networkCut before it', async () => {
        const lost = new FakePaymentProvider({
            clock,
            simulate: [{ simulation: 'lostResponse', why: 'test order retry' }]
        });
        const lostOrder = lost.placeOrder({ reference: 'lost', paid: true });
        await expect(
            lost.refundOrder({
                orderId: lostOrder.orderId,
                reference: 'key',
                scope: { kind: 'total' }
            })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        expect(
            (await lost.readOrder({ orderId: lostOrder.orderId })).snapshot.refunds
        ).toHaveLength(1);
        const cut = new FakePaymentProvider({
            clock,
            simulate: [{ simulation: 'networkCut', why: 'test no order mutation' }]
        });
        const cutOrder = cut.placeOrder({ reference: 'cut', paid: true });
        await expect(
            cut.refundOrder({
                orderId: cutOrder.orderId,
                reference: 'key',
                scope: { kind: 'total' }
            })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        expect((await cut.readOrder({ orderId: cutOrder.orderId })).snapshot.refunds).toHaveLength(
            0
        );
    });
});
