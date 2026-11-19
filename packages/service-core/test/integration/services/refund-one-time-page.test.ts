import { addonInstances, eq, payments } from '@repo/db';
import type { PaymentProvider, RefundInput } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures.js';
import { orderRefundRows } from './support/refund-order-fixtures.js';
import { refundPageFixture, spendFirstPartialRefusal } from './support/refund-page-fixtures.js';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** Wraps the fake so `refund` and `refundOrder` are observable; `override` replaces `refund`. */
function observed(
    provider: PaymentProvider,
    override?: (input: RefundInput) => ReturnType<PaymentProvider['refund']>
) {
    const refund = vi.fn(override ?? provider.refund.bind(provider));
    const refundOrder = vi.fn(provider.refundOrder.bind(provider));
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund') return refund;
            if (property === 'refundOrder') return refundOrder;
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund, refundOrder };
}

async function paymentRow(id: string) {
    const [row] = await getServiceTestDb().select().from(payments).where(eq(payments.id, id));
    if (!row) throw new Error('Payment missing');
    return row;
}

describe('HOS-2179 §5.11 AC-13 refund of a one-time page purchase', () => {
    it.skipIf(skip)(
        'refunds the total through the payment refund with a key persisted first',
        async () => {
            // Arrange
            const s = await refundPageFixture();
            let committedBeforeCall = { keys: 0, calls: 0 };
            const spy = observed(s.f.fake, async (input) => {
                const rows = await orderRefundRows(s.refundId);
                committedBeforeCall = { keys: rows.keys.length, calls: rows.calls.length };
                return s.f.fake.refund(input);
            });

            // Act
            const result = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );
            const executed = await executeRefundFromProviderRead(
                { refundId: s.refundId },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );

            // Assert
            expect(s.payment).toMatchObject({
                subscriptionId: null,
                addonInstanceId: s.instance.id
            });
            expect(s.instance.providerOrderId).toBeNull();
            expect(result).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
            expect(spy.refundOrder).not.toHaveBeenCalled();
            expect(spy.refund).toHaveBeenCalledTimes(1);
            expect(spy.refund).toHaveBeenCalledWith({
                chargeId: s.charge.chargeId,
                amount: { amountMinor: s.payment.amount, currency: 'ARS' },
                reference: `refund:${s.refundId}:1`
            });
            expect(committedBeforeCall).toEqual({ keys: 1, calls: 1 });
            const rows = await orderRefundRows(s.refundId);
            expect(rows.calls).toHaveLength(1);
            expect(rows.calls[0]).toMatchObject({
                addonInstanceId: null,
                amount: s.payment.amount,
                providerRefundId: result.calls[0]?.providerRefundId
            });
            expect(rows.keys[0]).toMatchObject({
                operation: 'REFUND_CREATE',
                result: { outcome: 'ACCEPTED' }
            });
            expect(executed.outcome).toBe('EXECUTED');
            expect(await paymentRow(s.payment.id)).toMatchObject({
                status: 'REFUNDED',
                refundedAmount: s.payment.amount
            });
        }
    );

    it.skipIf(skip)(
        'refunds a partial amount and leaves the payment partially refunded',
        async () => {
            // Arrange
            const s = await refundPageFixture({ refundAmount: 4000 });
            await spendFirstPartialRefusal({ f: s.f, chargeId: s.charge.chargeId });
            const spy = observed(s.f.fake);

            // Act
            const result = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );
            const executed = await executeRefundFromProviderRead(
                { refundId: s.refundId },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );

            // Assert
            expect(result).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
            expect(spy.refund).toHaveBeenCalledTimes(1);
            expect(spy.refund.mock.calls[0]?.[0].amount).toEqual({
                amountMinor: 4000,
                currency: 'ARS'
            });
            expect(executed.outcome).toBe('EXECUTED');
            expect(await paymentRow(s.payment.id)).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 4000
            });
        }
    );

    it.skipIf(skip)(
        'splits a partial the provider refuses as not refundable (M13 on)',
        async () => {
            // Arrange
            const s = await refundPageFixture({ refundAmount: 4000 });
            const spy = observed(s.f.fake);

            // Act
            const result = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );
            const executed = await executeRefundFromProviderRead(
                { refundId: s.refundId },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );

            // Assert
            expect(result.outcome).toBe('SENT');
            expect(spy.refund.mock.calls.map(([call]) => call.amount.amountMinor)).toEqual([
                4000, 2000, 2000
            ]);
            expect(executed.outcome).toBe('EXECUTED');
            expect((await paymentRow(s.payment.id)).refundedAmount).toBe(4000);
        }
    );

    it.skipIf(skip)(
        'replays a lost answer with the same key and binds it, moving the money once',
        async () => {
            // Arrange
            const s = await refundPageFixture();
            let lost = true;
            const spy = observed(s.f.fake, async (input) => {
                const answer = await s.f.fake.refund(input);
                if (lost) {
                    lost = false;
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'refund',
                        message: 'lost response'
                    });
                }
                return answer;
            });

            // Act
            const first = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );
            const before = await orderRefundRows(s.refundId);
            const replay = await resendUnansweredRefundCalls(
                { refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );
            const again = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            ).catch((error: unknown) => error);
            const executed = await executeRefundFromProviderRead(
                { refundId: s.refundId },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );

            // Assert
            expect(first).toMatchObject({
                status: 'CONFIRMED',
                outcome: 'AWAITING_PROVIDER_ANSWER'
            });
            expect(before.calls).toHaveLength(1);
            expect(before.keys[0]?.completedAt).toBeNull();
            const key = before.calls[0]!.idempotencyKey;
            expect(replay.outcomes).toEqual([{ idempotencyKey: key, outcome: 'SENT' }]);
            expect(spy.refund).toHaveBeenCalledTimes(2);
            expect(spy.refund.mock.calls[1]?.[0]).toEqual(spy.refund.mock.calls[0]?.[0]);
            expect(again).toMatchObject({ reason: 'REFUND_NOT_OPEN' });
            const charge = await s.f.fake.readCharge({ chargeId: s.charge.chargeId });
            expect(charge.snapshot.refunds).toHaveLength(1);
            const after = await orderRefundRows(s.refundId);
            expect(after.calls[0]?.providerRefundId).toBe(charge.snapshot.refunds[0]?.refundId);
            expect(executed.outcome).toBe('EXECUTED');
        }
    );

    it.skipIf(skip)(
        'fails the refund when the provider rejects it and moves no money',
        async () => {
            // Arrange
            const s = await refundPageFixture();
            const spy = observed(s.f.fake, async () => {
                throw new PaymentProviderError({
                    code: 'REJECTED',
                    capability: 'refund',
                    message: 'Mercado Pago refund failed (401)',
                    cause: {
                        status: 401,
                        body: { message: 'Unauthorized use of live credentials' }
                    }
                });
            });

            // Act
            const result = await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );

            // Assert
            expect(result).toMatchObject({ status: 'FAILED', outcome: 'PROVIDER_REJECTED_FAILED' });
            expect(spy.refundOrder).not.toHaveBeenCalled();
            const rows = await orderRefundRows(s.refundId);
            expect(rows.refund?.status).toBe('FAILED');
            expect(rows.keys[0]).toMatchObject({
                result: { outcome: 'REJECTED', code: 'REJECTED' }
            });
            expect(rows.keys[0]?.completedAt).toBeInstanceOf(Date);
            expect(await paymentRow(s.payment.id)).toMatchObject({
                status: 'SUCCEEDED',
                refundedAmount: 0
            });
            const charge = await s.f.fake.readCharge({ chargeId: s.charge.chargeId });
            expect(charge.snapshot.refunds).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        'sends nothing for an instance that claims both a page and an order',
        async () => {
            // Arrange
            const s = await refundPageFixture();
            await getServiceTestDb()
                .update(addonInstances)
                .set({ providerOrderId: `order-${crypto.randomUUID()}` })
                .where(eq(addonInstances.id, s.instance.id));
            const spy = observed(s.f.fake);

            // Act
            const confirming = confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: spy.wrapped }
            );

            // Assert
            await expect(confirming).rejects.toMatchObject({
                reason: 'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE'
            });
            expect(spy.refund).not.toHaveBeenCalled();
            expect(spy.refundOrder).not.toHaveBeenCalled();
            const rows = await orderRefundRows(s.refundId);
            expect(rows.refund?.status).toBe('REQUESTED');
            expect(rows.calls).toHaveLength(0);
        }
    );
});
