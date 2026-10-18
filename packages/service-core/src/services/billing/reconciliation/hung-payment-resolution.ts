import type { DrizzleClient } from '@repo/db';
import { and, eq, isNull, or, reconciliationMarkPayments } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { HangablePayment } from './reconciliation-mark-payments.port.js';

/** Resolves every still-unresolved mark attachment for one settled source payment. */
export async function resolveHungPaymentsBySettlement(input: {
    readonly tx: DrizzleClient;
    readonly payment: HangablePayment;
    readonly refundId: string;
    readonly at: Date;
}): Promise<number> {
    const sourceColumn =
        input.payment.source === 'PAYMENT'
            ? reconciliationMarkPayments.paymentId
            : reconciliationMarkPayments.manualPaymentId;
    const rows = await input.tx
        .update(reconciliationMarkPayments)
        .set({ resolvedAt: input.at, refundId: input.refundId })
        .where(
            and(eq(sourceColumn, input.payment.id), isNull(reconciliationMarkPayments.resolvedAt))
        )
        .returning({ id: reconciliationMarkPayments.id });
    return rows.length;
}

/** Resolves only the unresolved payments explicitly named for one mark, without a refund. */
export async function resolveHungPaymentsWithoutRefund(input: {
    readonly tx: DrizzleClient;
    readonly markId: string;
    readonly payments: readonly HangablePayment[];
    readonly at: Date;
}): Promise<void> {
    const unique = [
        ...new Map(
            input.payments.map((payment) => [`${payment.source}:${payment.id}`, payment])
        ).values()
    ];
    if (unique.length === 0) return;
    const named = unique.map((payment) =>
        eq(
            payment.source === 'PAYMENT'
                ? reconciliationMarkPayments.paymentId
                : reconciliationMarkPayments.manualPaymentId,
            payment.id
        )
    );
    const rows = await input.tx
        .update(reconciliationMarkPayments)
        .set({ resolvedAt: input.at })
        .where(
            and(
                eq(reconciliationMarkPayments.markId, input.markId),
                isNull(reconciliationMarkPayments.resolvedAt),
                or(...named)
            )
        )
        .returning({ id: reconciliationMarkPayments.id });
    if (rows.length !== unique.length)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'A named payment is not an unresolved payment hung on this mark',
            undefined,
            'MARK_PAYMENT_NOT_HUNG'
        );
}
