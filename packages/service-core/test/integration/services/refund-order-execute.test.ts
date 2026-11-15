import { eq, refunds } from '@repo/db';
import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { executeRows } from './support/refund-execute-fixtures.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('HOS-1553 TEST:B6:6 AC:B6:8 order RF3 execution', () => {
    it.skipIf(skip)('executes an accredited total through P3', async () => {
        const seeded = await refundOrderFixture();
        const confirmed = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        expect(confirmed.outcome).toBe('SENT');
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const rows = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result.outcome).toBe('EXECUTED');
        expect(result.paymentEffect?.outcome).toBe('P3');
        expect(rows.refund).toMatchObject({ status: 'EXECUTED', executedVia: 'PROVIDER' });
        expect(rows.payment).toMatchObject({ status: 'REFUNDED', refundedAmount: 10000 });
    });

    it.skipIf(skip)('keeps a held provider refund confirmed with unchanged payment', async () => {
        const seeded = await refundOrderFixture();
        const confirmed = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const id = confirmed.calls[0]?.providerRefundId;
        if (!id) throw new Error('Missing order refund id');
        seeded.fixture.provider.holdOrderRefund({ orderId: seeded.orderId, refundId: id });
        const before = await executeRows(seeded.refundId, seeded.payment.id);
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const after = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result.outcome).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
        expect(after.refund).toMatchObject({
            status: 'CONFIRMED',
            version: before.refund!.version
        });
        expect(after.payment).toMatchObject({
            refundedAmount: before.payment!.refundedAmount,
            version: before.payment!.version
        });
    });

    it.skipIf(skip)('never substitutes an unrelated equal amount order refund', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const confirmed = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const ownId = confirmed.calls[0]?.providerRefundId;
        if (!ownId) throw new Error('Missing own refund id');
        seeded.fixture.provider.holdOrderRefund({ orderId: seeded.orderId, refundId: ownId });
        const order = await seeded.fixture.provider.readOrder({ orderId: seeded.orderId });
        await seeded.fixture.provider.refundOrder({
            orderId: seeded.orderId,
            reference: `unrelated-${crypto.randomUUID()}`,
            scope: {
                kind: 'partial',
                transactionId: order.snapshot.paymentTransactionId!,
                amount: { amountMinor: 4000, currency: 'ARS' }
            }
        });
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const rows = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result.outcome).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
        expect(rows.refund?.status).toBe('CONFIRMED');
        expect(rows.payment?.refundedAmount).toBe(0);
        expect(
            (await seeded.fixture.provider.readOrder({ orderId: seeded.orderId })).snapshot.refunds
        ).toHaveLength(2);
    });

    it.skipIf(skip)('rereads exactly once while a call awaits its answer', async () => {
        const seeded = await refundOrderFixture();
        const readOrder = vi.fn(seeded.fixture.provider.readOrder.bind(seeded.fixture.provider));
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                if (property === 'readOrder') return readOrder;
                if (property === 'refundOrder')
                    return async (input: OrderRefundInput) => {
                        await target.refundOrder(input);
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        const confirmed = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
        readOrder.mockClear();
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        expect(result.outcome).toBe('AWAITING_PROVIDER_ANSWER');
        expect(readOrder).toHaveBeenCalledTimes(1);
        expect((await orderRefundRows(seeded.refundId)).calls).toHaveLength(1);
    });

    it.skipIf(skip)(
        'leaves an add-on without an order not applicable without provider reads',
        async () => {
            const seeded = await refundOrderFixture({ withOrder: false });
            await getServiceTestDb()
                .update(refunds)
                .set({ status: 'CONFIRMED' })
                .where(eq(refunds.id, seeded.refundId));
            const readOrder = vi.fn(
                seeded.fixture.provider.readOrder.bind(seeded.fixture.provider)
            );
            const readCharge = vi.fn(
                seeded.fixture.provider.readCharge.bind(seeded.fixture.provider)
            );
            const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    if (property === 'readOrder') return readOrder;
                    if (property === 'readCharge') return readCharge;
                    return Reflect.get(target, property, receiver);
                }
            });
            const result = await executeRefundFromProviderRead(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            expect(result.outcome).toBe('NOT_APPLICABLE');
            expect(readOrder).toHaveBeenCalledTimes(0);
            expect(readCharge).toHaveBeenCalledTimes(0);
        }
    );
});
