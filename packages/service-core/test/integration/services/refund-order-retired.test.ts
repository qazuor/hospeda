/**
 * HOS-2179 T-7: the order refund channel is retired. A one-time instance bought through
 * `/v1/orders` (a provider order and no payment page) has no refund channel left: its
 * refund is never confirmed, executed or replayed through the provider, and no provider
 * call is made. A person settles it outside our flow (action 14).
 */
import { eq, idempotencyKeys, refundCalls, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';
import { orderRefundRows, refundOrderFixture } from './support/refund-order-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

/** Wraps the provider so every method call is recorded, whatever its name. */
function recordingProvider(provider: PaymentProvider) {
    const calls: string[] = [];
    const wrapped = new Proxy(provider, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                calls.push(String(property));
                return value.apply(target, args);
            };
        }
    });
    return { wrapped, calls };
}

describe('HOS-2179 T-7 the order refund channel is retired', () => {
    it.skipIf(skip)(
        'refuses to confirm the refund of an order-bought instance and calls no provider method',
        async () => {
            // Arrange
            const seeded = await refundOrderFixture();
            const provider = recordingProvider(seeded.fixture.provider);

            // Act
            const attempt = confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: provider.wrapped }
            );

            // Assert
            await expect(attempt).rejects.toMatchObject({
                reason: 'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE'
            });
            expect(provider.calls).toEqual([]);
            const rows = await orderRefundRows(seeded.refundId);
            expect(rows.refund?.status).toBe('REQUESTED');
            expect(rows.calls).toEqual([]);
            expect(rows.keys).toEqual([]);
        }
    );

    it.skipIf(skip)('never executes a confirmed refund of an order-bought instance', async () => {
        // Arrange: a refund confirmed before the channel was retired.
        const seeded = await refundOrderFixture();
        await getServiceTestDb()
            .update(refunds)
            .set({ status: 'CONFIRMED', confirmedBy: seeded.actor.id, version: 2 })
            .where(eq(refunds.id, seeded.refundId));
        const provider = recordingProvider(seeded.fixture.provider);

        // Act
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: provider.wrapped }
        );

        // Assert
        expect(result).toMatchObject({ outcome: 'NOT_APPLICABLE', paymentEffect: null });
        expect(provider.calls).toEqual([]);
        expect((await orderRefundRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });

    it.skipIf(skip)(
        'never replays an unanswered order refund call and calls no provider method',
        async () => {
            // Arrange: a confirmed refund with an unanswered call tied to its instance, the
            // shape the retired order channel persisted.
            const seeded = await refundOrderFixture();
            const key = `refund:${seeded.refundId}:1`;
            await getServiceTestDb()
                .update(refunds)
                .set({ status: 'CONFIRMED', confirmedBy: seeded.actor.id, version: 2 })
                .where(eq(refunds.id, seeded.refundId));
            await getServiceTestDb()
                .insert(idempotencyKeys)
                .values({ key, operation: 'REFUND_CREATE', subjectId: seeded.refundId });
            await getServiceTestDb().insert(refundCalls).values({
                refundId: seeded.refundId,
                idempotencyKey: key,
                amount: 10000,
                providerRefundId: null,
                addonInstanceId: seeded.instance.instanceId
            });
            const provider = recordingProvider(seeded.fixture.provider);
            const refund = vi.spyOn(seeded.fixture.provider, 'refund');

            // Act
            const replay = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: provider.wrapped }
            );

            // Assert
            expect(replay).toEqual({
                refundId: seeded.refundId,
                outcomes: [{ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' }]
            });
            expect(provider.calls).toEqual([]);
            expect(refund).not.toHaveBeenCalled();
            const rows = await orderRefundRows(seeded.refundId);
            expect(rows.calls[0]?.providerRefundId).toBeNull();
            expect(rows.keys[0]?.completedAt).toBeNull();
        }
    );

    it.skipIf(skip)(
        'ties no refund call to an instance, so the order hold index holds nothing',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 4000);

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            expect(result.outcome).toBe('SENT');
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.calls.length).toBeGreaterThan(0);
            expect(rows.calls.map((call) => call.addonInstanceId)).toEqual(
                rows.calls.map(() => null)
            );
        }
    );
});
