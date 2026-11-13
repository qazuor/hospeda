import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });
const input = {
    reference: 'request-1',
    idempotencyKey: 'key-1',
    amount: { amountMinor: 2500, currency: 'ARS' },
    payerEmail: 'buyer@example.test',
    paymentToken: 'token-1',
    paymentBrand: 'master',
    paymentKind: 'credit' as const
};

describe('HOS-1554 AC:B6:12 RP15/RP16 fake order charge', () => {
    it('replays one order and one payment for an identical key and body', async () => {
        const fake = new FakePaymentProvider({ clock });
        const first = await fake.chargeOnce(input);
        expect(await fake.chargeOnce(input)).toEqual(first);
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });

    it('refuses a changed token under the same key and keeps the first payment', async () => {
        const fake = new FakePaymentProvider({ clock });
        await fake.chargeOnce(input);
        await expect(fake.chargeOnce({ ...input, paymentToken: 'token-2' })).rejects.toMatchObject({
            code: 'REJECTED',
            refundRefusal: 'KEY_REUSED'
        });
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });

    it('creates two payments for two keys with one reference', async () => {
        const fake = new FakePaymentProvider({ clock });
        await fake.chargeOnce(input);
        await fake.chargeOnce({ ...input, idempotencyKey: 'key-2', paymentToken: 'token-2' });
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 2, paid: 2 });
    });

    it('returns a failed order for a declined token and rereads it unpaid', async () => {
        const fake = new FakePaymentProvider({ clock });
        fake.declineOrderPayments({ paymentToken: input.paymentToken });
        const result = await fake.chargeOnce(input);
        expect(result.declined).toBe(true);
        expect(
            (await fake.readOrder({ orderId: result.orderId })).snapshot.hasApprovedPayment
        ).toBe(false);
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 0 });
    });

    it('refuses a used token under a fresh key', async () => {
        const fake = new FakePaymentProvider({ clock });
        await fake.chargeOnce(input);
        await expect(fake.chargeOnce({ ...input, idempotencyKey: 'key-2' })).rejects.toMatchObject({
            code: 'REJECTED'
        });
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });

    it('creates the order before losing its response', async () => {
        const fake = new FakePaymentProvider({
            clock,
            simulate: [{ simulation: 'lostResponse', why: 'exercise a lost creation answer' }]
        });
        await expect(fake.chargeOnce(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        expect(fake.ordersFor({ reference: input.reference })).toEqual({ orders: 1, paid: 1 });
    });
});
