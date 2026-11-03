import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { sendHeldOrderRefund } from '../../../src/services/billing/refund/send-held-order-refund.service.js';
import { closeServiceTestPool, getServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

async function waitForBlockedCallInserts(barrierPid: number, expected: number): Promise<void> {
    for (let poll = 0; poll < 100; poll++) {
        const blocked = await getServiceTestPool().query<{ count: number }>(
            `WITH direct AS (
                 SELECT pid FROM pg_stat_activity WHERE $1 = ANY (pg_blocking_pids(pid))
             )
             SELECT count(*)::int AS count FROM pg_stat_activity
             WHERE (pid IN (SELECT pid FROM direct)
                OR pg_blocking_pids(pid) && ARRAY(SELECT pid FROM direct))
               AND query ILIKE '%insert%refund_call%'`,
            [barrierPid]
        );
        if (blocked.rows[0]?.count === expected) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Expected ${expected} refund_call inserts blocked before commit`);
}

describe('HOS-1553 TEST:B6:7 AC:B6:9 order refund held by the database', () => {
    it.skipIf(skip)(
        'retries the held refund after the first unanswered call gets its id',
        async () => {
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const secondRequest = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: seeded.payment.id },
                    amount: 3000,
                    reason: 'REVOCATION'
                },
                { clock: seeded.fixture.clock }
            );
            let first = true;
            const refundOrder = async (input: OrderRefundInput) => {
                const response = await seeded.fixture.provider.refundOrder(input);
                if (first) {
                    first = false;
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'refund',
                        message: 'lost response'
                    });
                }
                return response;
            };
            const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    return property === 'refundOrder'
                        ? refundOrder
                        : Reflect.get(target, property, receiver);
                }
            });
            const firstResult = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const secondResult = await confirmRefund(
                { actor: seeded.actor, refundId: secondRequest.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            expect(firstResult.outcome).toBe('AWAITING_PROVIDER_ANSWER');
            expect(secondResult.outcome).toBe('ORDER_REFUND_HELD');
            const stillHeld = await sendHeldOrderRefund(
                { refundId: secondRequest.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            expect(stillHeld.outcome).toBe('ORDER_REFUND_HELD');
            expect((await orderRefundRows(secondRequest.refundId)).calls).toHaveLength(0);
            const resent = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            expect(resent.outcomes[0]?.outcome).toBe('SENT');
            expect(
                (await orderRefundRows(seeded.refundId)).calls[0]?.providerRefundId
            ).toBeTruthy();
            const released = await sendHeldOrderRefund(
                { refundId: secondRequest.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const secondRows = await orderRefundRows(secondRequest.refundId);
            expect(released.outcome).toBe('SENT');
            expect(secondRows.calls).toHaveLength(1);
            expect(secondRows.calls[0]?.providerRefundId).toBeTruthy();
            expect(
                (await seeded.fixture.provider.readOrder({ orderId: seeded.orderId })).snapshot
                    .refunds
            ).toHaveLength(2);
        }
    );
    it.skipIf(skip)(
        'holds a second concurrent refund insert while the first awaits its id',
        async () => {
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const secondRequest = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: seeded.payment.id },
                    amount: 3000,
                    reason: 'REVOCATION'
                },
                { clock: seeded.fixture.clock }
            );
            let signalFirstRead: (() => void) | undefined;
            const firstReadStarted = new Promise<void>((resolve) => {
                signalFirstRead = resolve;
            });
            let releaseFirstRead: (() => void) | undefined;
            const firstReadBarrier = new Promise<void>((resolve) => {
                releaseFirstRead = resolve;
            });
            let signalSecondRead: (() => void) | undefined;
            const secondReadStarted = new Promise<void>((resolve) => {
                signalSecondRead = resolve;
            });
            let releaseSecondRead: (() => void) | undefined;
            const secondReadBarrier = new Promise<void>((resolve) => {
                releaseSecondRead = resolve;
            });
            const lostResponse = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    if (property === 'readOrder')
                        return async (...args: Parameters<PaymentProvider['readOrder']>) => {
                            signalFirstRead?.();
                            await firstReadBarrier;
                            return target.readOrder(...args);
                        };
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
            const firstPending = confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lostResponse }
            );
            await firstReadStarted;
            const secondProvider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    if (property === 'readOrder')
                        return async (...args: Parameters<PaymentProvider['readOrder']>) => {
                            signalSecondRead?.();
                            await secondReadBarrier;
                            return target.readOrder(...args);
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            const secondPending = confirmRefund(
                { actor: seeded.actor, refundId: secondRequest.refundId },
                { clock: seeded.fixture.clock, provider: secondProvider }
            );
            await secondReadStarted;
            const barrier = await getServiceTestPool().connect();
            try {
                await barrier.query('BEGIN');
                await barrier.query('SELECT id FROM addon_instance WHERE id = $1 FOR UPDATE', [
                    seeded.instance.instanceId
                ]);
                const barrierPid = (
                    await barrier.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                ).rows[0]?.pid;
                if (barrierPid === undefined) throw new Error('Missing barrier backend pid');
                releaseFirstRead?.();
                await waitForBlockedCallInserts(barrierPid, 1);
                releaseSecondRead?.();
                await waitForBlockedCallInserts(barrierPid, 2);
                await barrier.query('COMMIT');
            } finally {
                releaseFirstRead?.();
                releaseSecondRead?.();
                await barrier.query('ROLLBACK');
                barrier.release();
            }
            const [first, second] = await Promise.all([firstPending, secondPending]);
            const firstRows = await orderRefundRows(seeded.refundId);
            const secondRows = await orderRefundRows(secondRequest.refundId);
            const order = await seeded.fixture.provider.readOrder({ orderId: seeded.orderId });
            expect(first).toMatchObject({
                status: 'CONFIRMED',
                outcome: 'AWAITING_PROVIDER_ANSWER'
            });
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
            expect([...firstRows.calls, ...secondRows.calls]).toHaveLength(1);
            expect(order.snapshot.refunds).toHaveLength(1);
        },
        15_000
    );

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
