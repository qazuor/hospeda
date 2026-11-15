import {
    and,
    eq,
    idempotencyKeys,
    payments,
    reconciliationMarkPayments,
    refundCalls,
    refunds
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { listActionableReconciliationMarks } from '../../../src/services/billing/reconciliation/actionable-marks.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:2 AC:B6:2 a chargeback resolves the hung payment without refunding it', () => {
    it.skipIf(skip)(
        'marks CONTRACARGO, fails the refund, and leaves the payment and proposal unrefunded',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            const { mark } = await openReconciliationMark(
                {
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: seeded.fixture.started.subscriptionId
                    },
                    reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                    payment: { source: 'PAYMENT', id: seeded.payment.id },
                    actor: { type: 'admin', id: seeded.actor.id },
                    correlationId: crypto.randomUUID()
                },
                { markPayments: createPaymentReconciliationMarkPayments(seeded.fixture.clock) }
            );
            await seeded.fixture.provider.chargeBack({ chargeId: seeded.charge.chargeId });
            const db = getServiceTestDb();
            const [paymentBefore] = await db
                .select({
                    status: payments.status,
                    refundedAmount: payments.refundedAmount,
                    version: payments.version
                })
                .from(payments)
                .where(eq(payments.id, seeded.payment.id));

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const [refund] = await db.select().from(refunds).where(eq(refunds.id, seeded.refundId));
            const [paymentAfter] = await db
                .select({
                    status: payments.status,
                    refundedAmount: payments.refundedAmount,
                    version: payments.version
                })
                .from(payments)
                .where(eq(payments.id, seeded.payment.id));
            const [proposal] = await db
                .select()
                .from(reconciliationMarkPayments)
                .where(
                    and(
                        eq(reconciliationMarkPayments.markId, mark.id),
                        eq(reconciliationMarkPayments.paymentId, seeded.payment.id)
                    )
                );
            const [calls] = await db
                .select({ id: refundCalls.id })
                .from(refundCalls)
                .where(eq(refundCalls.refundId, seeded.refundId));
            const [key] = await db
                .select({ key: idempotencyKeys.key })
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, seeded.refundId));
            const actionable = await listActionableReconciliationMarks({ page: 1, pageSize: 100 });
            expect(result).toMatchObject({ status: 'FAILED', outcome: 'CHARGED_BACK', calls: [] });
            expect(refund?.status).toBe('FAILED');
            expect(calls).toBeUndefined();
            expect(key).toBeUndefined();
            expect(paymentAfter).toEqual(paymentBefore);
            expect(proposal).toMatchObject({ resolvedAt: expect.any(Date), refundId: null });
            expect(
                actionable.items.find(
                    (item) =>
                        item.reason === 'CONTRACARGO' &&
                        item.payments.some((entry) => entry.paymentId === seeded.payment.id)
                )
            ).toBeDefined();
        }
    );
});
