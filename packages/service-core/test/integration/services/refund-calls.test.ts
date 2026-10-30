import { eq, idempotencyKeys, refundCalls } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { extractPostgresErrorCause } from '../../../src/utils/postgres-error-cause.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { creditedPayment } from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

/** Seeds one provider call of a refund: its persisted key, the provider refund id and its amount. */
async function seedCall(input: {
    readonly refundId: string;
    readonly providerRefundId: string;
    readonly amount: number;
}) {
    const key = `refund-create-${crypto.randomUUID()}`;
    await getServiceTestDb()
        .insert(idempotencyKeys)
        .values({ key, operation: 'REFUND_CREATE', subjectId: input.refundId });
    return getServiceTestDb()
        .insert(refundCalls)
        .values({
            refundId: input.refundId,
            idempotencyKey: key,
            providerRefundId: input.providerRefundId,
            amount: input.amount
        })
        .returning();
}

describe('TEST:B5:6 AC:B5:12 each call keeps its key, refund id and amount on the row', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:12 (k) two partials of one refund leave two ids on the same row',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );
            const first = `mp-refund-${crypto.randomUUID()}`;
            const second = `mp-refund-${crypto.randomUUID()}`;

            // Act
            await seedCall({ refundId, providerRefundId: first, amount: 4000 });
            await seedCall({ refundId, providerRefundId: second, amount: 6000 });

            // Assert
            const calls = await getServiceTestDb()
                .select()
                .from(refundCalls)
                .where(eq(refundCalls.refundId, refundId));
            expect(calls.map((call) => [call.providerRefundId, call.amount]).sort()).toEqual(
                [
                    [first, 4000],
                    [second, 6000]
                ].sort()
            );
            expect(new Set(calls.map((call) => call.idempotencyKey)).size).toBe(2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:12 (k) the same provider refund id on a call of ANOTHER refund is rejected by the base',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const request = (amount: number) =>
                requestRefund(
                    {
                        source: { kind: 'PAYMENT', id: credited.payment.id },
                        amount,
                        reason: 'MARK_PROPOSAL'
                    },
                    { clock: credited.fixture.clock }
                );
            const owner = await request(4000);
            const intruder = await request(3000);
            const providerRefundId = `mp-refund-${crypto.randomUUID()}`;
            await seedCall({ refundId: owner.refundId, providerRefundId, amount: 4000 });

            // Act
            let error: unknown = null;
            try {
                await seedCall({ refundId: intruder.refundId, providerRefundId, amount: 3000 });
            } catch (caught) {
                error = caught;
            }

            // Assert
            const cause = extractPostgresErrorCause(error);
            expect(cause?.code).toBe('23505');
            expect(cause?.constraint).toBe('uq_refund_call_provider_refund_id');
            const calls = await getServiceTestDb()
                .select()
                .from(refundCalls)
                .where(eq(refundCalls.refundId, intruder.refundId));
            expect(calls).toEqual([]);
        }
    );
});
