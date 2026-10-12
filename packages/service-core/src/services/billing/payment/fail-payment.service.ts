import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

export interface FailPaymentResult {
    readonly outcome: 'FAILED' | 'NOT_PENDING';
}

/**
 * P2: fails a pending payment after its charge-record window expired without collection.
 * The caller must have read that fact by payment id. The B7.1 expiry surface is not wired here.
 */
export async function failPayment(
    input: { readonly paymentId: string },
    ports: { readonly clock: Clock }
): Promise<FailPaymentResult> {
    return getDb().transaction(async (tx) => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const [payment] = await tx
                .select()
                .from(payments)
                .where(eq(payments.id, input.paymentId))
                .limit(1);
            if (!payment)
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Payment not found',
                    undefined,
                    'PAYMENT_NOT_FOUND'
                );
            if (payment.status !== 'PENDING') return { outcome: 'NOT_PENDING' };
            const [failed] = await tx
                .update(payments)
                .set({
                    status: 'FAILED',
                    version: payment.version + 1,
                    updatedAt: ports.clock.now()
                })
                .where(
                    and(
                        eq(payments.id, payment.id),
                        eq(payments.status, 'PENDING'),
                        eq(payments.version, payment.version)
                    )
                )
                .returning({ id: payments.id });
            if (failed) return { outcome: 'FAILED' };
        }
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Payment failure lost repeated optimistic races',
            undefined,
            'PAYMENT_FAIL_RACE_EXHAUSTED'
        );
    });
}
