import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, idempotencyKeys, refundCalls, refunds } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '../../../types';
import { authorizeRefundAction, readRefundSubject } from './refund-action-authorization';
import { failRefund } from './refund-fail';
import { lockRefundSource } from './refund-source';

/** Closed set of typed action 13 decline rejection reasons. */
export const DECLINE_REFUND_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_OPEN',
    'REFUND_STATE_CHANGED',
    'REFUND_HAS_PROVIDER_CALLS'
] as const;

/** A typed rejection from declining a refund. */
export type DeclineRefundRejection = (typeof DECLINE_REFUND_REJECTIONS)[number];

/** Declines an open refund through RF5 without changing its payment. */
export async function declineRefund(
    input: { readonly actor: Actor; readonly refundId: string; readonly correlationId?: string },
    ports: { readonly clock: Clock }
): Promise<{
    readonly refundId: string;
    readonly status: 'FAILED';
    readonly subjectId: string | null;
}> {
    return getDb().transaction(async (tx) => {
        const [candidate] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1);
        if (!candidate)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Refund not found',
                undefined,
                'REFUND_NOT_FOUND'
            );
        const source = candidate.paymentId
            ? { kind: 'PAYMENT' as const, id: candidate.paymentId }
            : { kind: 'MANUAL_PAYMENT' as const, id: candidate.manualPaymentId ?? '' };
        const locked = await lockRefundSource({ tx, source });
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1)
            .for('update');
        if (
            !refund ||
            refund.paymentId !== candidate.paymentId ||
            refund.manualPaymentId !== candidate.manualPaymentId
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund source changed',
                undefined,
                'REFUND_STATE_CHANGED'
            );
        if (refund.status !== 'REQUESTED' && refund.status !== 'CONFIRMED')
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund is no longer open',
                undefined,
                'REFUND_NOT_OPEN'
            );
        const subjectId = await readRefundSubject({
            tx,
            subscriptionId:
                locked.kind === 'PAYMENT'
                    ? locked.payment.subscriptionId
                    : locked.manualPayment.subscriptionId,
            addonInstanceId: locked.kind === 'PAYMENT' ? locked.payment.addonInstanceId : null
        });
        authorizeRefundAction({ actor: input.actor, subjectId });
        if (refund.status === 'CONFIRMED') {
            const calls = await tx
                .select({
                    providerRefundId: refundCalls.providerRefundId,
                    result: idempotencyKeys.result
                })
                .from(refundCalls)
                .leftJoin(idempotencyKeys, eq(idempotencyKeys.key, refundCalls.idempotencyKey))
                .where(eq(refundCalls.refundId, refund.id));
            if (calls.some((call) => call.providerRefundId !== null || call.result === null))
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Refund has accepted or unanswered provider calls',
                    undefined,
                    'REFUND_HAS_PROVIDER_CALLS'
                );
        }
        const failed = await failRefund({
            tx,
            refund,
            at: ports.clock.now(),
            correlationId: input.correlationId ?? crypto.randomUUID()
        });
        if (!failed.failed)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed',
                undefined,
                'REFUND_STATE_CHANGED'
            );
        return { refundId: refund.id, status: 'FAILED', subjectId };
    });
}
