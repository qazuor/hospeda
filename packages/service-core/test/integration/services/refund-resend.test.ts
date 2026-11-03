import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

function lostResponseProvider(provider: PaymentProvider, kind: 'refund' | 'refundOrder') {
    const refund = vi.fn(provider.refund.bind(provider));
    const refundOrder = vi.fn(provider.refundOrder.bind(provider));
    let first = true;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === kind)
                return async (input: Parameters<PaymentProvider[typeof kind]>[0]) => {
                    const result =
                        kind === 'refund'
                            ? await refund(input as Parameters<PaymentProvider['refund']>[0])
                            : await refundOrder(input as OrderRefundInput);
                    if (first) {
                        first = false;
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    }
                    return result;
                };
            if (property === 'refund') return refund;
            if (property === 'refundOrder') return refundOrder;
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund, refundOrder };
}

describe('HOS-1553 TEST:B6:8 AC:B6:10 refund call resend', () => {
    it.skipIf(skip)(
        'replays a payment with the same key and amount and binds the empty response by reread',
        async () => {
            const seeded = await refundConfirmFixture(10000, 4000);
            try {
                await seeded.fixture.provider.refund({
                    chargeId: seeded.charge.chargeId,
                    amount: { amountMinor: 1, currency: 'ARS' },
                    reference: `m13-${crypto.randomUUID()}`
                });
            } catch (error) {
                expect(error).toMatchObject({ refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
            }
            const lost = lostResponseProvider(seeded.fixture.provider, 'refund');
            const first = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            expect(first.outcome).toBe('AWAITING_PROVIDER_ANSWER');
            const before = await refundConfirmRows(seeded.refundId);
            expect(before.calls).toHaveLength(1);
            const key = before.calls[0]!.idempotencyKey;
            const replay = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            expect(replay.outcomes).toEqual([{ idempotencyKey: key, outcome: 'SENT' }]);
            expect(lost.refund).toHaveBeenNthCalledWith(2, {
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: before.calls[0]!.amount, currency: 'ARS' },
                reference: key
            });
            const after = await refundConfirmRows(seeded.refundId);
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            expect(after.calls).toHaveLength(1);
            expect(after.keys).toHaveLength(1);
            expect(charge.snapshot.refunds).toHaveLength(1);
            expect(after.calls[0]?.providerRefundId).toBe(charge.snapshot.refunds[0]?.refundId);
            expect(after.keys[0]?.result).toEqual({
                outcome: 'ACCEPTED',
                providerRefundId: charge.snapshot.refunds[0]?.refundId
            });
            expect(
                (
                    await executeRefundFromProviderRead(
                        { refundId: seeded.refundId },
                        { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
                    )
                ).outcome
            ).toBe('EXECUTED');
        }
    );

    it.skipIf(skip)(
        'leaves a payment call pending with two unnamed equal amount candidates',
        async () => {
            const seeded = await refundConfirmFixture(10000, 4000);
            try {
                await seeded.fixture.provider.refund({
                    chargeId: seeded.charge.chargeId,
                    amount: { amountMinor: 1, currency: 'ARS' },
                    reference: `m13-${crypto.randomUUID()}`
                });
            } catch (error) {
                expect(error).toMatchObject({ refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
            }
            const lost = lostResponseProvider(seeded.fixture.provider, 'refund');
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            await seeded.fixture.provider.refund({
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: 4000, currency: 'ARS' },
                reference: `unrelated-${crypto.randomUUID()}`
            });
            const replay = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            const rows = await refundConfirmRows(seeded.refundId);
            expect(replay.outcomes).toEqual([
                {
                    idempotencyKey: rows.calls[0]!.idempotencyKey,
                    outcome: 'AWAITING_PROVIDER_ANSWER'
                }
            ]);
            expect(rows.calls).toHaveLength(1);
            expect(rows.calls[0]?.providerRefundId).toBeNull();
            expect(rows.keys[0]?.completedAt).toBeNull();
            expect(
                (await seeded.fixture.provider.readCharge({ chargeId: seeded.charge.chargeId }))
                    .snapshot.refunds
            ).toHaveLength(2);
        }
    );

    it.skipIf(skip)(
        'replays an order with the same key and partial scope and binds by subtraction',
        async () => {
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const lost = lostResponseProvider(seeded.fixture.provider, 'refundOrder');
            const first = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            expect(first.outcome).toBe('AWAITING_PROVIDER_ANSWER');
            const before = await orderRefundRows(seeded.refundId);
            const replay = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            expect(replay.outcomes).toEqual([
                { idempotencyKey: before.calls[0]!.idempotencyKey, outcome: 'SENT' }
            ]);
            expect(lost.refundOrder).toHaveBeenNthCalledWith(
                2,
                lost.refundOrder.mock.calls[0]?.[0]
            );
            const after = await orderRefundRows(seeded.refundId);
            const order = await seeded.fixture.provider.readOrder({ orderId: seeded.orderId });
            expect(after.calls).toHaveLength(1);
            expect(order.snapshot.refunds).toHaveLength(1);
            expect(after.calls[0]?.providerRefundId).toBe(order.snapshot.refunds[0]?.refundId);
        }
    );

    it.skipIf(skip)('keeps an order key pending after a 409 replay', async () => {
        const seeded = await refundOrderFixture();
        const lost = lostResponseProvider(seeded.fixture.provider, 'refundOrder');
        await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: lost.wrapped }
        );
        const conflict = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                if (property === 'refundOrder')
                    return async () => {
                        throw new PaymentProviderError({
                            code: 'REJECTED',
                            capability: 'refund',
                            refundRefusal: 'KEY_REUSED',
                            message: 'conflict'
                        });
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        const replay = await resendUnansweredRefundCalls(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: conflict }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(replay.outcomes).toEqual([
            { idempotencyKey: rows.calls[0]!.idempotencyKey, outcome: 'PROVIDER_KEY_CONFLICT' }
        ]);
        expect(rows.calls[0]?.providerRefundId).toBeNull();
        expect(rows.keys[0]?.completedAt).toBeNull();
    });

    it.skipIf(skip)('does nothing when the confirmed refund has no unanswered call', async () => {
        const seeded = await refundOrderFixture();
        const refund = vi.fn(seeded.fixture.provider.refund.bind(seeded.fixture.provider));
        const refundOrder = vi.fn(
            seeded.fixture.provider.refundOrder.bind(seeded.fixture.provider)
        );
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                if (property === 'refund') return refund;
                if (property === 'refundOrder') return refundOrder;
                return Reflect.get(target, property, receiver);
            }
        });
        const replay = await resendUnansweredRefundCalls(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        expect(replay).toEqual({ refundId: seeded.refundId, outcomes: [] });
        expect(refund).toHaveBeenCalledTimes(0);
        expect(refundOrder).toHaveBeenCalledTimes(0);
        expect((await orderRefundRows(seeded.refundId)).calls).toHaveLength(0);
    });
});
