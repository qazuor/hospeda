import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, coveredPeriods, eq, getDb, payments, refunds, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

export type ApplyExecutedRefundResult =
    | {
          readonly outcome:
              | 'REFUND_NOT_EXECUTED'
              | 'NOT_A_PROVIDER_PAYMENT'
              | 'NOT_APPLICABLE'
              | 'ALREADY_APPLIED';
      }
    | {
          readonly outcome: 'P3' | 'P4' | 'P5';
          readonly refundedAmount: number;
          readonly status: 'PARTIALLY_REFUNDED' | 'REFUNDED';
          readonly coverageReleased: boolean;
      };

export async function applyExecutedRefund(
    input: { readonly refundId: string },
    ports: { readonly clock: Clock; readonly tx?: DrizzleClient }
): Promise<ApplyExecutedRefundResult> {
    const apply = async (tx: DrizzleClient): Promise<ApplyExecutedRefundResult> => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const [refund] = await tx
                .select()
                .from(refunds)
                .where(eq(refunds.id, input.refundId))
                .limit(1);
            if (refund?.status !== 'EXECUTED') return { outcome: 'REFUND_NOT_EXECUTED' };
            if (!refund.paymentId) return { outcome: 'NOT_A_PROVIDER_PAYMENT' };

            const [payment] = await tx
                .select()
                .from(payments)
                .where(eq(payments.id, refund.paymentId))
                .limit(1);
            if (
                !payment ||
                !['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)
            )
                return { outcome: 'NOT_APPLICABLE' };

            const [sum] = await tx
                .select({ amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
                .from(refunds)
                .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'EXECUTED')));
            const refundedAmount = sum?.amount ?? 0;
            if (refundedAmount > payment.amount)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Executed refunds exceed payment amount',
                    undefined,
                    'REFUND_EXCEEDS_PAYMENT'
                );
            if (refundedAmount === payment.refundedAmount) return { outcome: 'ALREADY_APPLIED' };

            const status = refundedAmount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
            const [updated] = await tx
                .update(payments)
                .set({
                    status,
                    refundedAmount,
                    version: payment.version + 1,
                    updatedAt: ports.clock.now()
                })
                .where(and(eq(payments.id, payment.id), eq(payments.version, payment.version)))
                .returning({ id: payments.id });
            if (!updated) continue;

            let coverageReleased = false;
            if (status === 'REFUNDED') {
                const released = await tx
                    .update(coveredPeriods)
                    .set({ releasedAt: ports.clock.now() })
                    .where(
                        and(
                            eq(coveredPeriods.paymentId, payment.id),
                            sql`${coveredPeriods.releasedAt} IS NULL`
                        )
                    )
                    .returning({ id: coveredPeriods.id });
                coverageReleased = released.length > 0;
            }
            let outcome: 'P3' | 'P4' | 'P5';
            if (payment.status === 'SUCCEEDED') {
                if (status === 'REFUNDED') outcome = 'P3';
                else outcome = 'P4';
            } else {
                outcome = 'P5';
            }
            return { outcome, refundedAmount, status, coverageReleased };
        }
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Refund application lost repeated optimistic races',
            undefined,
            'REFUND_APPLY_RACE_EXHAUSTED'
        );
    };
    return ports.tx ? apply(ports.tx) : getDb().transaction(apply);
}
