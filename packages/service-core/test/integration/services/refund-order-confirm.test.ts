import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('HOS-1553 TEST:B6:6 AC:B6:8 order RF2 confirmation', () => {
    it.skipIf(skip)(
        'sends a total once after its key and call commit, then binds the new id',
        async () => {
            const seeded = await refundOrderFixture();
            let committed = { keys: 0, calls: 0 };
            const refundOrder = vi.fn(async (input: OrderRefundInput) => {
                const rows = await orderRefundRows(seeded.refundId);
                committed = { keys: rows.keys.length, calls: rows.calls.length };
                return seeded.fixture.provider.refundOrder(input);
            });
            const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    if (property === 'refundOrder') return refundOrder;
                    return Reflect.get(target, property, receiver);
                }
            });
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const rows = await orderRefundRows(seeded.refundId);
            expect(result).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
            expect(refundOrder).toHaveBeenCalledTimes(1);
            expect(refundOrder.mock.calls[0]?.[0].scope).toEqual({ kind: 'total' });
            expect(committed).toEqual({ keys: 1, calls: 1 });
            expect(rows.calls).toHaveLength(1);
            expect(rows.calls[0]).toMatchObject({
                addonInstanceId: seeded.instance.instanceId,
                providerRefundId: result.calls[0]?.providerRefundId
            });
            expect(rows.keys).toHaveLength(1);
            expect(rows.keys[0]).toMatchObject({ result: { outcome: 'ACCEPTED' } });
            expect(rows.keys[0]?.completedAt).toBeInstanceOf(Date);
            expect(rows.refund?.status).toBe('CONFIRMED');
        }
    );

    it.skipIf(skip)(
        'sends a partial with the transaction id from the fresh order read',
        async () => {
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const read = await seeded.fixture.provider.readOrder({ orderId: seeded.orderId });
            const refundOrder = vi.fn((input: OrderRefundInput) =>
                seeded.fixture.provider.refundOrder(input)
            );
            const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, property, receiver) {
                    return property === 'refundOrder'
                        ? refundOrder
                        : Reflect.get(target, property, receiver);
                }
            });
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            expect(result.outcome).toBe('SENT');
            expect(refundOrder).toHaveBeenCalledTimes(1);
            expect(refundOrder.mock.calls[0]?.[0].scope).toEqual({
                kind: 'partial',
                transactionId: read.snapshot.paymentTransactionId,
                amount: { amountMinor: 4000, currency: 'ARS' }
            });
        }
    );

    it.skipIf(skip)('subtracts previously recorded order refund ids', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const first = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const secondRequest = await requestRefund(
            {
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 3000,
                reason: 'REVOCATION'
            },
            { clock: seeded.fixture.clock }
        );
        const second = await confirmRefund(
            { actor: seeded.actor, refundId: secondRequest.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        const rows = await orderRefundRows(secondRequest.refundId);
        expect(first.outcome).toBe('SENT');
        expect(second.outcome).toBe('SENT');
        expect(rows.calls).toHaveLength(1);
        expect(rows.calls[0]?.providerRefundId).toBe(second.calls[0]?.providerRefundId);
        expect(
            new Set([first.calls[0]?.providerRefundId, second.calls[0]?.providerRefundId]).size
        ).toBe(2);
    });

    it.skipIf(skip)('keeps a 409 unanswered and confirmed', async () => {
        const seeded = await refundOrderFixture();
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                return property === 'refundOrder'
                    ? async () => {
                          throw new PaymentProviderError({
                              code: 'REJECTED',
                              capability: 'refund',
                              refundRefusal: 'KEY_REUSED',
                              message: '409'
                          });
                      }
                    : Reflect.get(target, property, receiver);
            }
        });
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(result).toMatchObject({ status: 'CONFIRMED', outcome: 'PROVIDER_KEY_CONFLICT' });
        expect(rows.keys).toHaveLength(1);
        expect(rows.keys[0]?.completedAt).toBeNull();
        expect(rows.calls).toHaveLength(1);
        expect(rows.calls[0]?.providerRefundId).toBeNull();
        expect(rows.refund?.status).toBe('CONFIRMED');
    });

    it.skipIf(skip)('frees the order after definitive rejection', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const rejectedProvider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                return property === 'refundOrder'
                    ? async () => {
                          throw new PaymentProviderError({
                              code: 'REJECTED',
                              capability: 'refund',
                              message: 'declined'
                          });
                      }
                    : Reflect.get(target, property, receiver);
            }
        });
        const first = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: rejectedProvider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        const request = await requestRefund(
            {
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 3000,
                reason: 'REVOCATION'
            },
            { clock: seeded.fixture.clock }
        );
        const second = await confirmRefund(
            { actor: seeded.actor, refundId: request.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );
        expect(first).toMatchObject({ status: 'FAILED', outcome: 'PROVIDER_REJECTED_FAILED' });
        expect(second.outcome).toBe('SENT');
        expect(rows.refund?.status).toBe('FAILED');
        expect(rows.calls).toHaveLength(0);
        expect(rows.keys).toHaveLength(1);
        expect(rows.keys[0]).toMatchObject({ result: { outcome: 'REJECTED', code: 'REJECTED' } });
        expect(rows.keys[0]?.completedAt).toBeInstanceOf(Date);
    });

    it.skipIf(skip)('keeps an unpaid order confirmed without a call', async () => {
        const seeded = await refundOrderFixture({ paid: false });
        const refundOrder = vi.fn((input: OrderRefundInput) =>
            seeded.fixture.provider.refundOrder(input)
        );
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                return property === 'refundOrder'
                    ? refundOrder
                    : Reflect.get(target, property, receiver);
            }
        });
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(result).toMatchObject({
            status: 'CONFIRMED',
            outcome: 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED',
            calls: []
        });
        expect(refundOrder).toHaveBeenCalledTimes(0);
        expect(rows.calls).toHaveLength(0);
    });

    it.skipIf(skip)(
        'rejects an add-on payment with no provider order without moving it',
        async () => {
            const seeded = await refundOrderFixture({ withOrder: false });
            const before = await orderRefundRows(seeded.refundId);
            await expect(
                confirmRefund(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE' });
            const after = await orderRefundRows(seeded.refundId);
            expect(after.refund).toMatchObject({
                status: 'REQUESTED',
                amount: before.refund?.amount,
                version: before.refund?.version
            });
            expect(after.calls).toHaveLength(0);
        }
    );

    it.skipIf(skip)('keeps an unavailable order confirmed without a call', async () => {
        const seeded = await refundOrderFixture();
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                return property === 'readOrder'
                    ? async () => {
                          throw new PaymentProviderError({
                              code: 'UNAVAILABLE',
                              capability: 'read',
                              message: 'unavailable'
                          });
                      }
                    : Reflect.get(target, property, receiver);
            }
        });
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(result).toMatchObject({
            status: 'CONFIRMED',
            outcome: 'AWAITING_PROVIDER_ANSWER',
            calls: []
        });
        expect(rows.calls).toHaveLength(0);
    });

    it.skipIf(skip)('does not persist a partial without a payment transaction id', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                if (property === 'readOrder')
                    return async (input: Parameters<PaymentProvider['readOrder']>[0]) => {
                        const read = await target.readOrder(input);
                        return {
                            ...read,
                            snapshot: { ...read.snapshot, paymentTransactionId: null }
                        };
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(result).toMatchObject({
            status: 'CONFIRMED',
            outcome: 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED',
            calls: []
        });
        expect(rows.keys).toHaveLength(0);
        expect(rows.calls).toHaveLength(0);
    });

    it.skipIf(skip)('leaves an ambiguous provider response unanswered', async () => {
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
            get(target, property, receiver) {
                if (property === 'refundOrder')
                    return async (input: OrderRefundInput) => {
                        const response = await target.refundOrder(input);
                        return {
                            refunds: [
                                ...response.refunds,
                                { refundId: 'unexpected', amountMinor: 4000, accredited: false }
                            ]
                        };
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const rows = await orderRefundRows(seeded.refundId);
        expect(result).toMatchObject({ status: 'CONFIRMED', outcome: 'AWAITING_PROVIDER_ANSWER' });
        expect(rows.calls).toHaveLength(1);
        expect(rows.calls[0]?.providerRefundId).toBeNull();
        expect(rows.keys).toHaveLength(1);
        expect(rows.keys[0]?.completedAt).toBeNull();
    });
});
