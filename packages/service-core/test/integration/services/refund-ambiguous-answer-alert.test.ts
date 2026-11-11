import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { OrderRefundInput, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AmbiguousRefundAnswerError } from '../../../src/services/billing/refund/ambiguous-refund-answer.error.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture } from './support/refund-confirm-fixtures.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);
const skip = !isServiceTestDbAvailable();

type Captured = { readonly error: unknown; readonly extra: Record<string, unknown> };

function capturing(): Captured[] {
    const captured: Captured[] = [];
    registerCaptureHook((error, extra) => captured.push({ error, extra }));
    return captured;
}

function ambiguousFor(captured: Captured[], refundId: string): Captured[] {
    return captured.filter(
        ({ error }) => error instanceof AmbiguousRefundAnswerError && error.refundId === refundId
    );
}

function lostResponseProvider(provider: PaymentProvider) {
    const refund = vi.fn(provider.refund.bind(provider));
    let first = true;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    const result = await refund(input);
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
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund };
}

describe('HOS-2007 an ambiguous refund answer raises a Sentry capture with its refund, order or payment and candidates', () => {
    it.skipIf(skip)(
        'two unknown order refund ids: captures SEVERAL_NEW_ORDER_REFUNDS with both candidates',
        async () => {
            // Arrange
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const captured = capturing();
            let fakeRefundId = '';
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refundOrder')
                        return async (input: OrderRefundInput) => {
                            const response = await target.refundOrder(input);
                            fakeRefundId = response.refunds[0]!.refundId;
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

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const rows = await orderRefundRows(seeded.refundId);
            const matches = ambiguousFor(captured, seeded.refundId);
            const error = matches[0]?.error;

            // Assert
            expect(matches).toHaveLength(1);
            expect(error).toMatchObject({
                kind: 'ORDER',
                refundId: seeded.refundId,
                orderId: seeded.orderId,
                paymentId: seeded.payment.id,
                providerFactId: seeded.payment.providerFactId,
                expectedAmountMinor: 4000,
                reason: 'SEVERAL_NEW_ORDER_REFUNDS'
            });
            expect(
                error instanceof AmbiguousRefundAnswerError
                    ? [...error.candidates].sort((a, b) =>
                          a.providerRefundId.localeCompare(b.providerRefundId)
                      )
                    : []
            ).toEqual(
                [
                    { providerRefundId: fakeRefundId, amountMinor: 4000 },
                    { providerRefundId: 'unexpected', amountMinor: 4000 }
                ].sort((a, b) => a.providerRefundId.localeCompare(b.providerRefundId))
            );
            expect(matches[0]?.extra.label).toBe(
                error instanceof Error ? error.message : undefined
            );
            expect(result.outcome).toBe('AWAITING_PROVIDER_ANSWER');
            expect(rows.keys[0]?.completedAt).toBeNull();
        }
    );

    it.skipIf(skip)(
        'one order refund id with another amount: captures ORDER_REFUND_AMOUNT_MISMATCH',
        async () => {
            // Arrange
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const captured = capturing();
            let fakeRefundId = '';
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refundOrder')
                        return async (input: OrderRefundInput) => {
                            const response = await target.refundOrder(input);
                            fakeRefundId = response.refunds[0]!.refundId;
                            return {
                                refunds: response.refunds.map((refund) => ({
                                    ...refund,
                                    amountMinor: 3999
                                }))
                            };
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const error = ambiguousFor(captured, seeded.refundId)[0]?.error;

            // Assert
            expect(error).toMatchObject({ reason: 'ORDER_REFUND_AMOUNT_MISMATCH' });
            expect(error instanceof AmbiguousRefundAnswerError ? error.candidates : []).toEqual([
                { providerRefundId: fakeRefundId, amountMinor: 3999 }
            ]);
        }
    );

    it.skipIf(skip)(
        'no new order refund id: captures NO_NEW_ORDER_REFUND with no candidates',
        async () => {
            // Arrange
            const seeded = await refundOrderFixture({ refundAmount: 4000 });
            const captured = capturing();
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refundOrder') return async () => ({ refunds: [] });
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const error = ambiguousFor(captured, seeded.refundId)[0]?.error;

            // Assert
            expect(error).toMatchObject({ reason: 'NO_NEW_ORDER_REFUND' });
            expect(error instanceof AmbiguousRefundAnswerError ? error.candidates : []).toEqual([]);
        }
    );

    it.skipIf(skip)(
        'two unnamed equal payment refunds on replay: captures SEVERAL_UNNAMED_PAYMENT_REFUNDS',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 4000);
            const captured = capturing();
            try {
                await seeded.fixture.provider.refund({
                    chargeId: seeded.charge.chargeId,
                    amount: { amountMinor: 1, currency: 'ARS' },
                    reference: `m13-${crypto.randomUUID()}`
                });
            } catch (error) {
                expect(error).toMatchObject({ refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
            }
            const lost = lostResponseProvider(seeded.fixture.provider);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            await seeded.fixture.provider.refund({
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: 4000, currency: 'ARS' },
                reference: `unrelated-${crypto.randomUUID()}`
            });

            // Act
            await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            const error = ambiguousFor(captured, seeded.refundId)[0]?.error;
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });

            // Assert
            expect(error).toMatchObject({
                kind: 'PAYMENT',
                orderId: null,
                paymentId: seeded.payment.id,
                providerFactId: seeded.charge.chargeId,
                expectedAmountMinor: 4000,
                reason: 'SEVERAL_UNNAMED_PAYMENT_REFUNDS'
            });
            expect(
                error instanceof AmbiguousRefundAnswerError
                    ? [...error.candidates].sort((a, b) =>
                          a.providerRefundId.localeCompare(b.providerRefundId)
                      )
                    : []
            ).toEqual(
                charge.snapshot.refunds
                    .map(({ refundId, amount }) => ({
                        providerRefundId: refundId,
                        amountMinor: amount.amountMinor
                    }))
                    .sort((a, b) => a.providerRefundId.localeCompare(b.providerRefundId))
            );
        }
    );

    it.skipIf(skip)(
        'no unnamed payment refund on replay: captures NO_UNNAMED_PAYMENT_REFUND',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 4000);
            const captured = capturing();
            try {
                await seeded.fixture.provider.refund({
                    chargeId: seeded.charge.chargeId,
                    amount: { amountMinor: 1, currency: 'ARS' },
                    reference: `m13-${crypto.randomUUID()}`
                });
            } catch (error) {
                expect(error).toMatchObject({ refundRefusal: 'AMOUNT_NOT_ACCEPTED' });
            }
            const lost = lostResponseProvider(seeded.fixture.provider);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lost.wrapped }
            );
            const provider = new Proxy(lost.wrapped, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                            const read = await target.readCharge(input);
                            return { ...read, snapshot: { ...read.snapshot, refunds: [] } };
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const error = ambiguousFor(captured, seeded.refundId)[0]?.error;

            // Assert
            expect(error).toMatchObject({ reason: 'NO_UNNAMED_PAYMENT_REFUND' });
            expect(error instanceof AmbiguousRefundAnswerError ? error.candidates : []).toEqual([]);
        }
    );

    it.skipIf(skip)('a single order refund with the right amount captures nothing', async () => {
        // Arrange
        const seeded = await refundOrderFixture({ refundAmount: 4000 });
        const captured = capturing();

        // Act
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );

        // Assert
        expect(ambiguousFor(captured, seeded.refundId)).toEqual([]);
        expect(result.outcome).toBe('SENT');
    });
});
