import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import {
    REFUND_CALL_RETRY_LIMIT_MS,
    retryRefundProviderCalls
} from '../../../src/services/billing/refund/retry-refund-provider-calls.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);
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

/** A provider the refund calls do not reach until `reach()`: the first call never landed. */
function cutProvider(provider: PaymentProvider) {
    const refund = vi.fn(provider.refund.bind(provider));
    const readCharge = vi.fn(provider.readCharge.bind(provider));
    let reachable = false;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'readCharge') return readCharge;
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    if (!reachable)
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'network cut'
                        });
                    return refund(input);
                };
            return Reflect.get(target, property, receiver);
        }
    });
    return {
        wrapped,
        refund,
        readCharge,
        reach() {
            reachable = true;
        }
    };
}

/** Confirms a refund whose only call never reached the provider: nothing at MP to bind. */
async function neverLanded() {
    const seeded = await refundConfirmFixture();
    const cut = cutProvider(seeded.fixture.provider);
    const confirmed = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: cut.wrapped }
    );
    expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
    cut.reach();
    return { seeded, cut };
}

describe('HOS-2516 the 24-hour limit only stops posting a call again', () => {
    it.skipIf(skip)(
        'past 24 hours, with nothing at MP to bind, refuses with 409 and posts nothing',
        async () => {
            // Arrange: the unanswered call was sent 24 hours and 1 ms ago and never landed.
            const { seeded, cut } = await neverLanded();
            seeded.fixture.clock.advance({ ms: REFUND_CALL_RETRY_LIMIT_MS + 1 });
            const captured: unknown[] = [];
            registerCaptureHook((error) => captured.push(error));

            // Act + Assert
            await expect(
                retryRefundProviderCalls(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: cut.wrapped }
                )
            ).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_CALL_TOO_OLD_TO_RETRY'
            });
            expect(cut.readCharge).toHaveBeenCalled();
            expect(cut.refund).not.toHaveBeenCalled();
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.keys[0]?.completedAt).toBeNull();
            expect(rows.keys[0]?.result).toBeNull();
            expect(rows.calls[0]?.providerRefundId).toBeNull();
            expect(rows.refund?.status).toBe('CONFIRMED');
            // The refusal raises no alert either: it leaves nothing behind.
            expect(captured).toEqual([]);
        }
    );

    it.skipIf(skip)('past 24 hours, binds a lost call that landed and executes', async () => {
        // Arrange: the call landed at MP but its answer was lost, more than 24 hours ago.
        const { seeded, lossy } = await stuckRefund();
        seeded.fixture.clock.advance({ ms: REFUND_CALL_RETRY_LIMIT_MS + 1 });

        // Act
        const result = await retryRefundProviderCalls(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: lossy.wrapped }
        );

        // Assert: the read and the binding still run; nothing is posted.
        expect(result.calls.map((call) => call.outcome)).toEqual(['FOUND_AT_PROVIDER']);
        expect(result.status).toBe('EXECUTED');
        expect(lossy.refund).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skip)('still posts a call sent exactly 24 hours ago', async () => {
        // Arrange
        const { seeded, cut } = await neverLanded();
        seeded.fixture.clock.advance({ ms: REFUND_CALL_RETRY_LIMIT_MS });

        // Act
        const result = await retryRefundProviderCalls(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: cut.wrapped }
        );

        // Assert
        expect(result.calls.map((call) => call.outcome)).toEqual(['SENT']);
        expect(cut.refund).toHaveBeenCalledTimes(1);
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

    it.skipIf(skip)(
        'never binds another refund of the payment to a provider refund rejected after acceptance',
        async () => {
            // Arrange: refund X (4000) is accepted, then MP rejects it, and the retry fails it.
            const seeded = await refundConfirmFixture(10000, 4000);
            await seeded.fixture.provider
                .refund({
                    chargeId: seeded.charge.chargeId,
                    amount: { amountMinor: 1, currency: 'ARS' },
                    reference: `m13-${crypto.randomUUID()}`
                })
                .catch(() => undefined);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            const xRefundId = (await refundConfirmRows(seeded.refundId)).calls[0]
                ?.providerRefundId as string;
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: xRefundId
            });
            const failed = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            expect(failed.status).toBe('FAILED');
            // Refund Y, same payment and amount, has a call that never reached MP.
            const y = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: seeded.payment.id },
                    amount: 4000,
                    reason: 'REVOCATION'
                },
                { clock: seeded.fixture.clock }
            );
            const cut = cutProvider(seeded.fixture.provider);
            await confirmRefund(
                { actor: seeded.actor, refundId: y.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );
            cut.reach();

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: y.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );

            // Assert: X's rejected refund is not Y's; Y posts its own and gets its own id.
            expect(result.calls.map((call) => call.outcome)).toEqual(['SENT']);
            expect(cut.refund).toHaveBeenCalledTimes(1);
            const yId = (await refundConfirmRows(y.refundId)).calls[0]?.providerRefundId;
            expect(yId).toEqual(expect.any(String));
            expect(yId).not.toBe(xRefundId);
        }
    );
});
