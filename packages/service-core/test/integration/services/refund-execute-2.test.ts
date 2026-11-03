import { eq, payments } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture } from './support/refund-confirm-fixtures.js';
import { confirmedExecuteFixture, executeRows } from './support/refund-execute-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:4 AC:B6:5 delayed and repeated provider reads', () => {
    it.skipIf(skip)(
        '(g) awaits an unanswered provider call without reading the charge',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            let readCount = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund') return async () => ({ refundId: '' });
                    if (property === 'readCharge')
                        return async (input: Parameters<typeof target.readCharge>[0]) => {
                            readCount++;
                            return target.readCharge(input);
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );
            readCount = 0;
            const before = await executeRows(seeded.refundId, seeded.payment.id);

            // Act
            const result = await executeRefundFromProviderRead(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );

            // Assert
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            expect(result).toEqual({
                refundId: seeded.refundId,
                outcome: 'AWAITING_PROVIDER_ANSWER',
                paymentEffect: null
            });
            expect(readCount).toBe(0);
            expect(after.refund).toMatchObject({
                status: 'CONFIRMED',
                version: before.refund!.version
            });
            expect({
                status: after.payment?.status,
                refundedAmount: after.payment?.refundedAmount,
                version: after.payment?.version
            }).toEqual({
                status: before.payment?.status,
                refundedAmount: before.payment?.refundedAmount,
                version: before.payment?.version
            });
        }
    );

    it.skipIf(skip)('(h) leaves a requested refund untouched', async () => {
        // Arrange
        const seeded = await refundConfirmFixture();
        const before = await executeRows(seeded.refundId, seeded.payment.id);

        // Act
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );

        // Assert
        const after = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result).toEqual({
            refundId: seeded.refundId,
            outcome: 'NOT_CONFIRMED',
            paymentEffect: null
        });
        expect(after.refund).toMatchObject({
            status: 'REQUESTED',
            version: before.refund!.version
        });
        expect({
            status: after.payment?.status,
            refundedAmount: after.payment?.refundedAmount,
            version: after.payment?.version
        }).toEqual({
            status: before.payment?.status,
            refundedAmount: before.payment?.refundedAmount,
            version: before.payment?.version
        });
    });

    it.skipIf(skip)(
        '(j) serializes two executions and applies the payment effect once',
        async () => {
            // Arrange
            const seeded = await confirmedExecuteFixture();
            let reads = 0;
            let release: (() => void) | undefined;
            const barrier = new Promise<void>((resolve) => {
                release = resolve;
            });
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async (input: Parameters<typeof target.readCharge>[0]) => {
                            const read = await target.readCharge(input);
                            reads++;
                            if (reads === 2) release?.();
                            await barrier;
                            return read;
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            const before = await executeRows(seeded.refundId, seeded.payment.id);

            // Act
            const results = await Promise.all([
                executeRefundFromProviderRead(
                    { refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider }
                ),
                executeRefundFromProviderRead(
                    { refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider }
                )
            ]);

            // Assert
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            expect(reads).toBe(2);
            expect(results.map((item) => item.outcome).sort()).toEqual([
                'EXECUTED',
                'REFUND_STATE_CHANGED'
            ]);
            expect(after.refund).toMatchObject({
                status: 'EXECUTED',
                version: before.refund!.version + 1
            });
            expect(after.payment).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 5000,
                version: before.payment!.version + 1
            });
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, seeded.payment.id));
            expect(payment?.refundedAmount).toBe(5000);
        }
    );
});
