import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectPayment, SelectRefund } from '@repo/db';
import { eq, getDb, refunds } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { failRefund } from './refund-fail';
import { lockRefundSource } from './refund-source';

/** Fails a confirmed refund after an answered rejection with no accepted amount. */
export async function failProviderRejectedRefund(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly clock: Clock;
    readonly correlationId: string;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        await lockRefundSource({ tx, source: { kind: 'PAYMENT', id: input.payment.id } });
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refund.id))
            .limit(1)
            .for('update');
        if (refund?.status !== 'CONFIRMED' || refund.version !== input.refund.version)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed before provider rejection handling',
                undefined,
                'REFUND_STATE_CHANGED'
            );
        const result = await failRefund({
            tx,
            refund,
            at: input.clock.now(),
            correlationId: input.correlationId
        });
        if (!result.failed)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed before provider rejection handling',
                undefined,
                'REFUND_STATE_CHANGED'
            );
    });
}
