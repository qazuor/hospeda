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
        'resends with the same key and amount, then RF3 executes what the read reports accredited',
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
                calls: [{ idempotencyKey: key, outcome: 'SENT' }],
                execution: 'EXECUTED'
            });
            expect(lossy.refund).toHaveBeenCalledTimes(2);
            expect(lossy.refund).toHaveBeenNthCalledWith(2, {
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: before.calls[0]!.amount, currency: 'ARS' },
                reference: key
            });
            const after = await refundConfirmRows(seeded.refundId);
            expect(after.calls).toHaveLength(1);
            expect(after.keys).toHaveLength(1);
            expect(after.keys[0]?.completedAt).not.toBeNull();
            expect(after.refund?.status).toBe('EXECUTED');
            const charge = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            expect(charge.snapshot.refunds).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'keeps the refund CONFIRMED when the provider accepted the call but has not accredited it',
        async () => {
            // Arrange: the lost call landed, then the provider reports it not accredited.
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

            // Assert: accepted is not accredited, so nothing is marked executed.
            expect(result.calls.map((call) => call.outcome)).toEqual(['SENT']);
            expect(result.execution).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
            expect(result.status).toBe('CONFIRMED');
            expect((await refundConfirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
        }
    );

    it.skipIf(skip)(
        'does not run RF3 while the provider still does not answer the resent call',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            const silent = lossyProvider(seeded.fixture.provider, 2);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: silent.wrapped }
            );
            const readCharge = vi.spyOn(seeded.fixture.provider, 'readCharge');

            // Act
            const result = await retryRefundProviderCalls(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: silent.wrapped }
            );

            // Assert
            expect(result.calls.map((call) => call.outcome)).toEqual(['AWAITING_PROVIDER_ANSWER']);
            expect(result.execution).toBeNull();
            expect(result.status).toBe('CONFIRMED');
            expect(readCharge).not.toHaveBeenCalled();
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.keys[0]?.completedAt).toBeNull();
        }
    );

    it.skipIf(skip)(
        'refuses a refund whose calls were all answered and sends nothing',
        async () => {
            // Arrange: a clean confirmation answers its only call.
            const seeded = await refundConfirmFixture();
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
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
            expect((await refundConfirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
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
