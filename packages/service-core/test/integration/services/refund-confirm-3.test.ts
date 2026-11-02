import { eq, idempotencyKeys } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:3 AC:B6:3 amount refusal retries only within the confirmed amount', () => {
    it.skipIf(skip)(
        'splits a partial confirmation into two calls with distinct persisted keys',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 5000);

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const rows = await refundConfirmRows(seeded.refundId);
            expect(result.outcome).toBe('SENT');
            expect(rows.refund?.status).toBe('CONFIRMED');
            expect(rows.calls).toHaveLength(3);
            expect(rows.calls.map((call) => call.amount)).toEqual([5000, 2500, 2500]);
            expect(new Set(rows.calls.map((call) => call.idempotencyKey)).size).toBe(3);
            expect(rows.calls.slice(1).every((call) => Boolean(call.providerRefundId))).toBe(true);
            expect(rows.calls.slice(1).reduce((sum, call) => sum + call.amount, 0)).toBe(5000);
            expect(
                rows.keys.find((key) => key.key === rows.calls[0]?.idempotencyKey)
            ).toMatchObject({
                result: { outcome: 'REJECTED', refusal: 'AMOUNT_NOT_ACCEPTED' },
                completedAt: expect.any(Date)
            });
        }
    );

    it.skipIf(skip)(
        'keeps the row confirmed and does not retry the total for a partial refund when every call gets 2084',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 5000);
            let callCount = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async () => {
                            callCount++;
                            throw new PaymentProviderError({
                                code: 'REJECTED',
                                capability: 'refund',
                                message: 'amount not accepted',
                                refundRefusal: 'AMOUNT_NOT_ACCEPTED'
                            });
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );

            // Assert
            const rows = await refundConfirmRows(seeded.refundId);
            expect(result.outcome).toBe('NOT_ACCEPTED_KEPT_CONFIRMED');
            expect(rows.refund?.status).toBe('CONFIRMED');
            expect(callCount).toBe(2);
            expect(rows.calls.map((call) => call.amount)).toEqual([5000, 2500]);
            expect(rows.calls.every((call) => call.amount <= 5000)).toBe(true);
        }
    );

    it.skipIf(skip)(
        'tries the confirmed total once more only when it equals the refundable balance',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 10000);
            let callCount = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async () => {
                            callCount++;
                            throw new PaymentProviderError({
                                code: 'REJECTED',
                                capability: 'refund',
                                message: 'amount not accepted',
                                refundRefusal: 'AMOUNT_NOT_ACCEPTED'
                            });
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );

            // Assert
            const rows = await refundConfirmRows(seeded.refundId);
            expect(result.outcome).toBe('NOT_ACCEPTED_KEPT_CONFIRMED');
            expect(rows.refund?.status).toBe('CONFIRMED');
            expect(callCount).toBe(3);
            expect(rows.calls.map((call) => call.amount)).toEqual([10000, 5000, 10000]);
            expect(rows.calls.every((call) => call.amount <= 10000)).toBe(true);
            expect(rows.keys).toHaveLength(3);
        }
    );
});

describe('TEST:B6:4 AC:B6:4 accepted partial calls are retained on the same refund row', () => {
    it.skipIf(skip)(
        'stores both provider ids, amounts, and distinct idempotency keys',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 5000);

            // Act
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const rows = await refundConfirmRows(seeded.refundId);
            const accepted = rows.calls.filter((call) => call.providerRefundId !== null);
            expect(accepted).toHaveLength(2);
            expect(new Set(accepted.map((call) => call.providerRefundId)).size).toBe(2);
            expect(new Set(accepted.map((call) => call.idempotencyKey)).size).toBe(2);
            expect(accepted.reduce((sum, call) => sum + call.amount, 0)).toBe(5000);
            const acceptedKeys = await getServiceTestDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, seeded.refundId));
            expect(
                acceptedKeys
                    .filter((key) => accepted.some((call) => call.idempotencyKey === key.key))
                    .every((key) => key.result !== null)
            ).toBe(true);
        }
    );
});
