import type { DrizzleClient, SelectRefund } from '@repo/db';
import { and, eq, refunds } from '@repo/db';
import { enqueueRevocationRefundFailedNotice } from '../reconciliation/revocation-refund-failed-notice';
import { canRefundTransition } from './refund-machine';

/** Applies RF5 and enqueues its revocation notice in the caller's transaction. */
export async function failRefund(input: {
    readonly tx: DrizzleClient;
    readonly refund: SelectRefund;
    readonly at: Date;
    readonly correlationId: string;
}): Promise<{ readonly failed: boolean }> {
    if (
        !canRefundTransition({
            transition: 'RF5',
            from: input.refund.status as 'REQUESTED' | 'CONFIRMED' | 'EXECUTED' | 'FAILED'
        }).allowed
    )
        return { failed: false };
    const [updated] = await input.tx
        .update(refunds)
        .set({ status: 'FAILED', version: input.refund.version + 1 })
        .where(and(eq(refunds.id, input.refund.id), eq(refunds.version, input.refund.version)))
        .returning({ id: refunds.id });
    if (!updated) return { failed: false };
    await enqueueRevocationRefundFailedNotice({
        tx: input.tx,
        refundId: input.refund.id,
        failedAt: input.at,
        correlationId: input.correlationId
    });
    return { failed: true };
}
