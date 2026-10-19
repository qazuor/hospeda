import { and, asc, eq, getDb, manualPayments, or, payments, refunds } from '@repo/db';
import type { SubscriptionOpenRefund } from '@repo/schemas';

/** Read the REQUESTED RF1 rows attached to payment ledgers of this subscription only (I-7). */
export async function readOpenRefunds({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): Promise<{ readonly items: readonly SubscriptionOpenRefund[] }> {
    const rows = await getDb()
        .select({
            refundId: refunds.id,
            refundAmount: refunds.amount,
            reason: refunds.reason,
            requestedAt: refunds.createdAt,
            paymentId: refunds.paymentId,
            manualPaymentId: refunds.manualPaymentId
        })
        .from(refunds)
        .leftJoin(payments, eq(payments.id, refunds.paymentId))
        .leftJoin(manualPayments, eq(manualPayments.id, refunds.manualPaymentId))
        .where(
            and(
                eq(refunds.status, 'REQUESTED'),
                or(
                    eq(payments.subscriptionId, subscriptionId),
                    eq(manualPayments.subscriptionId, subscriptionId)
                )
            )
        )
        .orderBy(asc(refunds.createdAt), asc(refunds.id));

    return {
        items: rows.map((row) => {
            if (row.paymentId) {
                return {
                    refundId: row.refundId,
                    refundAmount: row.refundAmount,
                    reason: row.reason,
                    requestedAt: row.requestedAt.toISOString(),
                    payment: { source: 'PAYMENT', id: row.paymentId }
                };
            }
            if (row.manualPaymentId) {
                return {
                    refundId: row.refundId,
                    refundAmount: row.refundAmount,
                    reason: row.reason,
                    requestedAt: row.requestedAt.toISOString(),
                    payment: { source: 'MANUAL_PAYMENT', id: row.manualPaymentId }
                };
            }
            throw new Error(`Refund ${row.refundId} has no payment ledger`);
        })
    };
}
