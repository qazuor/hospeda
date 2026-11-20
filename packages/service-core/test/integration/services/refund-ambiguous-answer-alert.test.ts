import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AmbiguousRefundAnswerError } from '../../../src/services/billing/refund/ambiguous-refund-answer.error.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

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

describe('HOS-2007 an ambiguous refund answer raises a Sentry capture with its refund, payment and candidates', () => {
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
            const rows = await refundConfirmRows(seeded.refundId);
            const matches = ambiguousFor(captured, seeded.refundId);
            expect(matches).toHaveLength(1);
            const error = matches[0]?.error;
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });

            // Assert
            expect(error).toMatchObject({
                kind: 'PAYMENT',
                paymentId: seeded.payment.id,
                providerFactId: seeded.charge.chargeId,
                expectedAmountMinor: 4000,
                reason: 'SEVERAL_UNNAMED_PAYMENT_REFUNDS',
                refundCallKey: rows.keys[0]?.key,
                candidateProviderRefundIds: expect.arrayContaining(
                    charge.snapshot.refunds.map(({ refundId }) => refundId)
                ),
                candidateAmountsMinor: expect.arrayContaining(
                    charge.snapshot.refunds.map(({ amount }) => amount.amountMinor)
                ),
                candidateSummary: expect.stringContaining(':4000')
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
            const outcomes = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            const matches = ambiguousFor(captured, seeded.refundId);
            expect(matches).toHaveLength(1);
            const error = matches[0]?.error;

            // Assert
            expect(error).toMatchObject({
                reason: 'NO_UNNAMED_PAYMENT_REFUND',
                candidateProviderRefundIds: [],
                candidateAmountsMinor: [],
                candidateSummary: ''
            });
            expect(outcomes.outcomes).toContainEqual(
                expect.objectContaining({ outcome: 'AWAITING_PROVIDER_ANSWER' })
            );
            expect(error instanceof AmbiguousRefundAnswerError ? error.candidates : []).toEqual([]);
        }
    );

    it.skipIf(skip)('a single payment refund with the right amount captures nothing', async () => {
        // Arrange
        const seeded = await refundConfirmFixture(10000, 4000);
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
