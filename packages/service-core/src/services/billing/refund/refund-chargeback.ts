import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, SelectPayment, SelectRefund } from '@repo/db';
import {
    and,
    eq,
    getDb,
    isNull,
    RECONCILIATION_MARK_REASON_CATALOG,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import {
    type ChargebackDetection,
    createChargebackDetection
} from '../reconciliation/chargeback/chargeback-detection';
import { resolveHungPaymentsWithoutRefund } from '../reconciliation/hung-payment-resolution';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';

/** Resolves a newly observed provider chargeback before failing the confirmed refund. */
export async function detectRefundChargeback(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly input: { readonly correlationId?: string };
    readonly ports: {
        readonly clock: Clock;
        readonly markPayments?: ReconciliationMarkPayments;
        readonly chargebacks?: ChargebackDetection;
    };
}): Promise<void> {
    const { payment } = input;
    const detection =
        input.ports.chargebacks ??
        createChargebackDetection({
            markPayments:
                input.ports.markPayments ??
                createPaymentReconciliationMarkPayments(input.ports.clock)
        });
    await detection.detect({
        payment: { id: payment.id, subscriptionId: payment.subscriptionId, status: payment.status },
        actor: 'provider',
        correlationId: input.input.correlationId ?? crypto.randomUUID()
    });
    await getDb().transaction(async (tx: DrizzleClient) => {
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refund.id))
            .limit(1)
            .for('update');
        if (refund?.status !== 'CONFIRMED')
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed before chargeback handling',
                undefined,
                'REFUND_STATE_CHANGED'
            );
        if (!(await canFail(tx, refund)))
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed before chargeback handling',
                undefined,
                'REFUND_STATE_CHANGED'
            );
        const markRows = await tx
            .select({
                markId: reconciliationMarkPayments.markId,
                reason: reconciliationMarks.reason
            })
            .from(reconciliationMarkPayments)
            .innerJoin(
                reconciliationMarks,
                eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
            )
            .where(
                and(
                    eq(reconciliationMarkPayments.paymentId, payment.id),
                    isNull(reconciliationMarkPayments.resolvedAt)
                )
            );
        const markIds = [
            ...new Set(
                markRows
                    .filter(
                        (row) =>
                            RECONCILIATION_MARK_REASON_CATALOG[
                                row.reason as keyof typeof RECONCILIATION_MARK_REASON_CATALOG
                            ]?.refundConfirmation === true
                    )
                    .map((row) => row.markId)
            )
        ];
        for (const markId of markIds) {
            await resolveHungPaymentsWithoutRefund({
                tx,
                markId,
                payments: [{ source: 'PAYMENT', id: payment.id }],
                at: input.ports.clock.now()
            });
        }
    });
}

async function canFail(tx: DrizzleClient, refund: SelectRefund): Promise<boolean> {
    const [updated] = await tx
        .update(refunds)
        .set({ status: 'FAILED', version: refund.version + 1 })
        .where(
            and(
                eq(refunds.id, refund.id),
                eq(refunds.status, 'CONFIRMED'),
                eq(refunds.version, refund.version)
            )
        )
        .returning({ id: refunds.id });
    return updated !== undefined;
}
