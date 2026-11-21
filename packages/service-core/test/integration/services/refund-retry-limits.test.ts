import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import {
    REFUND_CALL_RETRY_LIMIT_MS,
    retryRefundProviderCalls
} from '../../../src/services/billing/refund/retry-refund-provider-calls.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

/** A provider whose first refund answer is lost after it reached the fake (a timeout or a 5xx). */
function lossyProvider(provider: PaymentProvider) {
    const refund = vi.fn(provider.refund.bind(provider));
    const readCharge = vi.fn(provider.readCharge.bind(provider));
    let lost = false;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'readCharge') return readCharge;
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    const answer = await refund(input);
                    if (!lost) {
                        lost = true;
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    }
                    return answer;
                };
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund, readCharge };
}

async function stuckRefund() {
    const seeded = await refundConfirmFixture();
    const lossy = lossyProvider(seeded.fixture.provider);
    const confirmed = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: lossy.wrapped }
    );
    expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
    return { seeded, lossy };
}

describe('HOS-2516 owner decision: no resend of a call older than 24 hours', () => {
    it.skipIf(skip)(
        'refuses with REFUND_CALL_TOO_OLD_TO_RETRY before any provider call, past 24 hours',
        async () => {
            // Arrange: the unanswered call was sent 24 hours and 1 ms ago.
            const { seeded, lossy } = await stuckRefund();
            seeded.fixture.clock.advance({ ms: REFUND_CALL_RETRY_LIMIT_MS + 1 });
            lossy.readCharge.mockClear();

            // Act + Assert
            await expect(
                retryRefundProviderCalls(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: lossy.wrapped }
                )
            ).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_CALL_TOO_OLD_TO_RETRY'
            });
            expect(lossy.readCharge).not.toHaveBeenCalled();
            expect(lossy.refund).toHaveBeenCalledTimes(1);
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.keys[0]?.completedAt).toBeNull();
            expect(rows.refund?.status).toBe('CONFIRMED');
        }
    );

    it.skipIf(skip)('still resends a call sent exactly 24 hours ago', async () => {
        // Arrange
        const { seeded, lossy } = await stuckRefund();
        seeded.fixture.clock.advance({ ms: REFUND_CALL_RETRY_LIMIT_MS });

        // Act
        const result = await retryRefundProviderCalls(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: lossy.wrapped }
        );

        // Assert
        expect(result.calls.map((call) => call.outcome)).toEqual(['FOUND_AT_PROVIDER']);
    });
});

describe('HOS-2516 owner decision: a refund the provider accepted and then rejected', () => {
    it.skipIf(skip)(
        'records the accepted call as rejected by the provider and fails the refund (RF5)',
        async () => {
            // Arrange: a clean confirmation leaves its call accepted and the refund CONFIRMED;
            // then the provider rejects that refund.
            const seeded = await refundConfirmFixture();
            const refund = vi.spyOn(seeded.fixture.provider, 'refund');
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            const before = await refundConfirmRows(seeded.refundId);
            const providerRefundId = before.calls[0]?.providerRefundId;
            expect(providerRefundId).toEqual(expect.any(String));
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: providerRefundId!
            });

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert: no new refund was posted; the call is a provider rejection; RF5 ran.
            expect(result).toMatchObject({ status: 'FAILED', calls: [], execution: null });
            expect(refund).toHaveBeenCalledTimes(1);
            const after = await refundConfirmRows(seeded.refundId);
            expect(after.refund?.status).toBe('FAILED');
            expect(after.calls[0]?.providerRefundId).toBeNull();
            expect(after.keys[0]?.result).toEqual({
                outcome: 'REJECTED',
                code: 'REJECTED_AFTER_ACCEPTANCE',
                providerRefundId
            });
        }
    );

    it.skipIf(skip)(
        'fails a lost call found at the provider already rejected, instead of keeping it CONFIRMED',
        async () => {
            // Arrange: the lost call landed and the provider then rejected it.
            const { seeded, lossy } = await stuckRefund();
            const [landed] = (
                await seeded.fixture.provider.readCharge({ chargeId: seeded.charge.chargeId })
            ).snapshot.refunds;
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: landed!.refundId
            });

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lossy.wrapped }
            );

            // Assert
            expect(result.calls.map((call) => call.outcome)).toEqual(['FOUND_AT_PROVIDER']);
            expect(result.status).toBe('FAILED');
            expect(result.execution).toBeNull();
            expect(lossy.refund).toHaveBeenCalledTimes(1);
            expect((await refundConfirmRows(seeded.refundId)).refund?.status).toBe('FAILED');
        }
    );

    it.skipIf(skip)(
        'keeps the refund CONFIRMED when another accepted call still stands',
        async () => {
            // Arrange: the first partial refund is refused (lie M13), so the confirmation splits
            // it into two accepted calls; then the provider rejects only one of them.
            const seeded = await refundConfirmFixture(10000, 4000);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            const accepted = (await refundConfirmRows(seeded.refundId)).calls
                .map((call) => call.providerRefundId)
                .filter((id): id is string => id !== null);
            expect(accepted).toHaveLength(2);
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: accepted[0]!
            });

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert: the rejected call is recorded, the other still counts, nothing executes.
            expect(result.status).toBe('CONFIRMED');
            expect(result.execution).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
            const after = await refundConfirmRows(seeded.refundId);
            expect(after.refund?.status).toBe('CONFIRMED');
            expect(after.calls.map((call) => call.providerRefundId).filter(Boolean)).toEqual([
                accepted[1]
            ]);
        }
    );
});
