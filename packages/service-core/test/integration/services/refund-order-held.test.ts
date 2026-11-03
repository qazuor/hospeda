import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('HOS-1553 TEST:B6:7 AC:B6:9 order refund held by the database', () => {
    it.skipIf(skip)('holds a second refund while the first call awaits its id', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const secondRequest = await requestRefund(
            {
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 3000,
                reason: 'REVOCATION'
            },
            { clock: seeded.fixture.clock }
        );
        const lostResponse = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
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
        const first = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: lostResponse }
        );
        const second = await confirmRefund(
            { actor: seeded.actor, refundId: secondRequest.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const firstRows = await orderRefundRows(seeded.refundId);
        const secondRows = await orderRefundRows(secondRequest.refundId);
        const order = await seeded.fixture.provider.readOrder({ orderId: seeded.orderId });
        expect(first).toMatchObject({ status: 'CONFIRMED', outcome: 'AWAITING_PROVIDER_ANSWER' });
        expect(firstRows.calls).toHaveLength(1);
        expect(firstRows.calls[0]?.providerRefundId).toBeNull();
        expect(second).toMatchObject({
            status: 'CONFIRMED',
            outcome: 'ORDER_REFUND_HELD',
            calls: []
        });
        expect(secondRows.refund?.status).toBe('CONFIRMED');
        expect(secondRows.calls).toHaveLength(0);
        expect(secondRows.keys).toHaveLength(0);
        expect(order.snapshot.refunds).toHaveLength(1);
    });

    it.skipIf(skip)('does not hold calls on different orders', async () => {
        const first = await refundOrderFixture({ refundAmount: 4000 });
        const second = await refundOrderFixture({ refundAmount: 4000 });
        const a = await confirmRefund(
            { actor: first.actor, refundId: first.refundId },
            { clock: first.fixture.clock, provider: first.fixture.provider }
        );
        const b = await confirmRefund(
            { actor: second.actor, refundId: second.refundId },
            { clock: second.fixture.clock, provider: second.fixture.provider }
        );
        expect(a.outcome).toBe('SENT');
        expect(b.outcome).toBe('SENT');
        expect((await orderRefundRows(first.refundId)).calls).toHaveLength(1);
        expect((await orderRefundRows(second.refundId)).calls).toHaveLength(1);
    });
});
