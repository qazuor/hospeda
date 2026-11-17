import {
    and,
    asc,
    desc,
    eq,
    getDb,
    idempotencyKeys,
    inArray,
    isNotNull,
    manualPayments,
    or,
    payments,
    refunds,
    sql
} from '@repo/db';
import type { SubscriptionOpenRefund } from '@repo/schemas';
import { providerRefundWindow } from '@repo/service-core';
import { z } from 'zod';
import { getClock } from '../../../utils/clock';

const rejectionResultSchema = z.object({
    outcome: z.literal('REJECTED'),
    code: z.string().max(64).nullable().optional(),
    message: z.string().min(1).max(500),
    cause: z.unknown().optional()
});

function rejectionDetail(cause: unknown): string | null {
    const parsed = z
        .object({
            httpStatus: z.number().int().optional(),
            message: z.string().optional(),
            error: z.string().optional(),
            cause: z
                .array(z.object({ description: z.string().optional() }).passthrough())
                .optional()
        })
        .passthrough()
        .safeParse(cause);
    let detail: string | null = null;
    let status: number | undefined;
    if (parsed.success) {
        const value = parsed.data;
        detail = value.message ?? value.error ?? value.cause?.[0]?.description ?? null;
        status = value.httpStatus;
    } else if (typeof cause === 'string') detail = cause;
    if (!detail) return null;
    return `${status ? `HTTP ${status} · ` : ''}${detail}`.slice(0, 500);
}

/** Read REQUESTED and unsettled provider-rejected FAILED rows for this subscription (I-7). */
export async function readOpenRefunds({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): Promise<{ readonly items: readonly SubscriptionOpenRefund[] }> {
    const requestedRows = await getDb()
        .select({
            refundId: refunds.id,
            refundAmount: refunds.amount,
            reason: refunds.reason,
            requestedAt: refunds.createdAt,
            paymentId: refunds.paymentId,
            paymentFactAt: payments.factAt,
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

    const rejectedKeys = await getDb()
        .select()
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.operation, 'REFUND_CREATE'),
                sql`${idempotencyKeys.result}->>'outcome' = 'REJECTED'`,
                isNotNull(idempotencyKeys.completedAt)
            )
        )
        .orderBy(desc(idempotencyKeys.completedAt));
    const keyByRefund = new Map<string, (typeof rejectedKeys)[number]>();
    for (const key of rejectedKeys)
        if (!keyByRefund.has(key.subjectId)) keyByRefund.set(key.subjectId, key);
    const failedRows = await getDb()
        .select({
            refundId: refunds.id,
            refundAmount: refunds.amount,
            reason: refunds.reason,
            requestedAt: refunds.createdAt,
            paymentId: refunds.paymentId,
            paymentFactAt: payments.factAt,
            manualPaymentId: refunds.manualPaymentId,
            updatedAt: refunds.updatedAt
        })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .where(
            and(
                eq(refunds.status, 'FAILED'),
                eq(payments.subscriptionId, subscriptionId),
                sql`${refunds.paymentId} IS NOT NULL`
            )
        );
    const failedPaymentIds = [
        ...new Set(failedRows.map((row) => row.paymentId).filter((id): id is string => id !== null))
    ];
    const executions =
        failedPaymentIds.length > 0
            ? await getDb()
                  .select({
                      paymentId: refunds.paymentId,
                      amount: refunds.amount,
                      updatedAt: refunds.updatedAt
                  })
                  .from(refunds)
                  .where(
                      and(
                          inArray(refunds.paymentId, failedPaymentIds),
                          eq(refunds.status, 'EXECUTED')
                      )
                  )
            : [];
    const rows = [
        ...requestedRows.map((row) => ({
            ...row,
            status: 'REQUESTED' as const,
            providerRejection: null
        })),
        ...failedRows.flatMap((row) => {
            const key = keyByRefund.get(row.refundId);
            const parsed = rejectionResultSchema.safeParse(key?.result);
            const rejectedAt = key?.completedAt;
            if (!rejectedAt || !parsed.success) return [];
            const settledAfterRejection = executions
                .filter(
                    (execution) =>
                        execution.paymentId === row.paymentId && execution.updatedAt >= rejectedAt
                )
                .reduce((total, execution) => total + execution.amount, 0);
            if (settledAfterRejection >= row.refundAmount) return [];
            return [
                {
                    ...row,
                    status: 'FAILED' as const,
                    providerRejection: {
                        code: parsed.data.code ?? null,
                        message: parsed.data.message,
                        detail: rejectionDetail(parsed.data.cause),
                        rejectedAt: rejectedAt.toISOString()
                    }
                }
            ];
        })
    ].sort(
        (a, b) =>
            a.requestedAt.getTime() - b.requestedAt.getTime() ||
            a.refundId.localeCompare(b.refundId)
    );

    return {
        items: rows.map((row) => {
            if (row.paymentId) {
                if (!row.paymentFactAt)
                    throw new Error(`Payment ${row.paymentId} has no fact date`);
                const window = providerRefundWindow({
                    factAt: row.paymentFactAt,
                    now: getClock().clock.now()
                });
                return {
                    refundId: row.refundId,
                    refundAmount: row.refundAmount,
                    reason: row.reason,
                    requestedAt: row.requestedAt.toISOString(),
                    status: row.status,
                    providerRejection: row.providerRejection,
                    payment: { source: 'PAYMENT', id: row.paymentId },
                    providerRefundWindow: {
                        open: window.open,
                        closesAt: window.closesAt.toISOString()
                    }
                };
            }
            if (row.manualPaymentId) {
                return {
                    refundId: row.refundId,
                    refundAmount: row.refundAmount,
                    reason: row.reason,
                    requestedAt: row.requestedAt.toISOString(),
                    status: row.status,
                    providerRejection: row.providerRejection,
                    payment: { source: 'MANUAL_PAYMENT', id: row.manualPaymentId },
                    providerRefundWindow: null
                };
            }
            throw new Error(`Refund ${row.refundId} has no payment ledger`);
        })
    };
}
