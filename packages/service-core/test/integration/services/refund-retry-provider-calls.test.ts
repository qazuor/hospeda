import { eq, payments } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { retryRefundProviderCalls } from '../../../src/services/billing/refund/retry-refund-provider-calls.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

/**
 * A provider whose `refund` reaches the fake but whose answer is lost on the first `lostCalls`
 * calls (UNAVAILABLE), the way a timeout or a 5xx leaves a call unanswered.
 */
function lossyProvider(provider: PaymentProvider, lostCalls = 1) {
    const refund = vi.fn(provider.refund.bind(provider));
    let lost = 0;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    const answer = await refund(input);
                    if (lost < lostCalls) {
                        lost += 1;
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
    return { wrapped, refund };
}

/** A provider whose first `cutCalls` refund calls never reach the fake (the network is cut). */
function cutProvider(provider: PaymentProvider, cutCalls: number) {
    const refund = vi.fn(provider.refund.bind(provider));
    let cut = 0;
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    if (cut < cutCalls) {
                        cut += 1;
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'network cut'
                        });
                    }
                    return refund(input);
                };
            return Reflect.get(target, property, receiver);
        }
    });
    return { wrapped, refund };
}

/** Confirms a refund through a provider that loses the first answer: one call stays unanswered. */
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

describe('HOS-2516 retry the unanswered provider calls of a confirmed refund', () => {
    it.skipIf(skip)(
        'binds a lost call that landed from the charge read, posts nothing, then RF3 executes',
        async () => {
            // Arrange
            const { seeded, lossy } = await stuckRefund();
            const before = await refundConfirmRows(seeded.refundId);
            const key = before.calls[0]!.idempotencyKey;

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: lossy.wrapped }
            );

            // Assert
            expect(result).toMatchObject({
                refundId: seeded.refundId,
                status: 'EXECUTED',
                calls: [{ idempotencyKey: key, outcome: 'FOUND_AT_PROVIDER' }],
                execution: 'EXECUTED'
            });
            expect(lossy.refund).toHaveBeenCalledTimes(1);
            const after = await refundConfirmRows(seeded.refundId);
            expect(after.calls).toHaveLength(1);
            expect(after.calls[0]?.providerRefundId).toEqual(expect.any(String));
            expect(after.keys[0]?.completedAt).not.toBeNull();
            expect(after.refund?.status).toBe('EXECUTED');
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            expect(charge.snapshot.refunds).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'posts again with the same key and amount when the lost call never reached the provider',
        async () => {
            // Arrange: the network was cut before the first call reached the provider.
            const seeded = await refundConfirmFixture();
            const cut = cutProvider(seeded.fixture.provider, 1);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );
            const before = await refundConfirmRows(seeded.refundId);
            const key = before.calls[0]!.idempotencyKey;

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );

            // Assert
            expect(result).toMatchObject({
                status: 'EXECUTED',
                calls: [{ idempotencyKey: key, outcome: 'SENT' }],
                execution: 'EXECUTED'
            });
            expect(cut.refund).toHaveBeenCalledTimes(1);
            expect(cut.refund).toHaveBeenCalledWith({
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: before.calls[0]!.amount, currency: 'ARS' },
                reference: key
            });
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            expect(charge.snapshot.refunds).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'keeps the refund CONFIRMED when the provider has the refund but has not accredited it',
        async () => {
            // Arrange: the lost call landed, and the provider reads it still in process: neither
            // accredited nor rejected. Only a named rejection may fail the refund.
            const { seeded, lossy } = await stuckRefund();
            const inProcess = new Proxy(lossy.wrapped, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                            const read = await target.readCharge(input);
                            return {
                                ...read,
                                snapshot: {
                                    ...read.snapshot,
                                    refunds: read.snapshot.refunds.map((entry) => ({
                                        ...entry,
                                        accredited: false
                                    }))
                                }
                            };
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: inProcess }
            );

            // Assert: accepted is not accredited, so nothing is marked executed nor failed.
            expect(result.calls.map((call) => call.outcome)).toEqual(['FOUND_AT_PROVIDER']);
            expect(result.execution).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
            expect(result.status).toBe('CONFIRMED');
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.refund?.status).toBe('CONFIRMED');
            expect(rows.calls[0]?.providerRefundId).toEqual(expect.any(String));
        }
    );

    it.skipIf(skip)(
        'does not run RF3 while the provider still does not answer the resent call',
        async () => {
            // Arrange: neither the first call nor the resend reaches the provider.
            const seeded = await refundConfirmFixture();
            const cut = cutProvider(seeded.fixture.provider, 2);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );
            const readCharge = vi.spyOn(seeded.fixture.provider, 'readCharge');

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: cut.wrapped }
            );

            // Assert: the only read is the one before posting; RF3 never read the charge.
            expect(result.calls.map((call) => call.outcome)).toEqual(['AWAITING_PROVIDER_ANSWER']);
            expect(result.execution).toBeNull();
            expect(result.status).toBe('CONFIRMED');
            expect(readCharge).toHaveBeenCalledTimes(1);
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.keys[0]?.completedAt).toBeNull();
        }
    );

    it.skipIf(skip)(
        'runs RF3 again, posting nothing, when every call is accepted and nothing is unanswered',
        async () => {
            // Arrange: a clean confirmation leaves its only call accepted and the refund
            // CONFIRMED until a notice or a retry runs RF3.
            const seeded = await refundConfirmFixture();
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            expect((await refundConfirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
            const refund = vi.spyOn(seeded.fixture.provider, 'refund');

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            expect(result).toMatchObject({ status: 'EXECUTED', calls: [], execution: 'EXECUTED' });
            expect(refund).not.toHaveBeenCalled();
            expect((await refundConfirmRows(seeded.refundId)).refund?.status).toBe('EXECUTED');
        }
    );

    it.skipIf(skip)(
        'refuses a CONFIRMED refund with no accepted call and nothing unanswered, sending nothing',
        async () => {
            // Arrange: a 1-cent partial refund is refused (lie M13) and is not retried, so it
            // stays CONFIRMED with its only call answered as a refusal (NOT_ACCEPTED_KEPT_CONFIRMED).
            const seeded = await refundConfirmFixture(10000, 1);
            const confirmed = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            expect(confirmed.outcome).toBe('NOT_ACCEPTED_KEPT_CONFIRMED');
            const refund = vi.spyOn(seeded.fixture.provider, 'refund');

            // Act + Assert
            await expect(
                retryRefundProviderCalls(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
                )
            ).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_HAS_NO_UNANSWERED_CALL'
            });
            expect(refund).not.toHaveBeenCalled();
        }
    );

    it.skipIf(skip)('refuses a REQUESTED refund with REFUND_NOT_CONFIRMED', async () => {
        const seeded = await refundConfirmFixture();
        await expect(
            retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            )
        ).rejects.toMatchObject({ code: 'ALREADY_EXISTS', reason: 'REFUND_NOT_CONFIRMED' });
    });

    it.skipIf(skip)('answers an unknown refund with REFUND_NOT_FOUND', async () => {
        const seeded = await refundConfirmFixture();
        await expect(
            retryRefundProviderCalls(
                { actor: seeded.actor, refundId: crypto.randomUUID() },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            )
        ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'REFUND_NOT_FOUND' });
    });

    it.skipIf(skip)(
        'refuses an actor without action 13 before any business check and sends nothing',
        async () => {
            // Arrange
            const { seeded, lossy } = await stuckRefund();
            const outsider = { ...seeded.actor, permissions: [PermissionEnum.ACCESS_PANEL_ADMIN] };

            // Act + Assert
            await expect(
                retryRefundProviderCalls(
                    { actor: outsider, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: lossy.wrapped }
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            expect(lossy.refund).toHaveBeenCalledTimes(1);
        }
    );

    it.skipIf(skip)(
        'refuses a stuck refund past the provider window and leaves the call unanswered',
        async () => {
            // Arrange: the charge is older than 180 days by the time the person retries.
            const { seeded, lossy } = await stuckRefund();
            const factAt = new Date(seeded.fixture.clock.now().getTime() - 181 * 86400000);
            await getServiceTestDb()
                .update(payments)
                .set({ factAt })
                .where(eq(payments.id, seeded.payment.id));

            // Act + Assert
            await expect(
                retryRefundProviderCalls(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider: lossy.wrapped }
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REFUND_PAST_PROVIDER_WINDOW'
            });
            expect(lossy.refund).toHaveBeenCalledTimes(1);
            expect((await refundConfirmRows(seeded.refundId)).keys[0]?.completedAt).toBeNull();
        }
    );
});
