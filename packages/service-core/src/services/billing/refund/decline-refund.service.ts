import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, payments, refunds } from '@repo/db';
import { type RefundDeclineWarning, ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '../../../types';
import { heldByPageChargeMark } from '../addon/one-time-page-charge-marks';
import { authorizeRefundAction, readRefundSubject } from './refund-action-authorization';
import { failRefund } from './refund-fail';
import { refundHasLiveProviderCalls } from './refund-moved-money';
import { lockRefundSource } from './refund-source';

/** Closed set of typed action 13 decline rejection reasons. */
export const DECLINE_REFUND_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_OPEN',
    'REFUND_STATE_CHANGED',
    'REFUND_HAS_PROVIDER_CALLS',
    'REFUND_CLOSES_HELD_CHARGE'
] as const;

/** A typed rejection from declining a refund. */
export type DeclineRefundRejection = (typeof DECLINE_REFUND_REJECTIONS)[number];

/**
 * Declines an open refund through RF5 without changing its payment.
 *
 * The proposed refund of a held page charge (`MARK_PROPOSAL` on a payment a page-charge mark
 * holds, HOS-2179 D1) is refused with `REFUND_CLOSES_HELD_CHARGE` while it is `REQUESTED`, or
 * `CONFIRMED` with an accepted or unanswered provider call. It closes by being confirmed and
 * executed, by a chargeback, or by action 14 (which closes a `REQUESTED` refund or answers a
 * `FAILED` one, never a `CONFIRMED`). A `CONFIRMED` one with no such call (owner, option 1) can be
 * declined: it becomes `FAILED` and action 14 answers it with a manual refund.
 *
 * Every declined `CONFIRMED` refund carries `warning: 'VERIFY_NO_PROVIDER_REFUND'`: check the
 * provider's panel before refunding by hand. Each provider call is persisted before its POST
 * (`persistCall`), so a call-less `CONFIRMED` never reached the provider through our code; the
 * warning covers what that guarantee cannot see (a refund made from the panel itself).
 */
export async function declineRefund(
    input: { readonly actor: Actor; readonly refundId: string; readonly correlationId?: string },
    ports: { readonly clock: Clock }
): Promise<{
    readonly refundId: string;
    readonly status: 'FAILED';
    readonly subjectId: string | null;
    readonly warning?: RefundDeclineWarning;
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
        if (refund.reason === 'MARK_PROPOSAL' && candidate.paymentId) {
            const [held] = await tx
                .select({ held: heldByPageChargeMark() })
                .from(payments)
                .where(eq(payments.id, candidate.paymentId))
                .limit(1);
            // A held page charge (HOS-2179 D1, owner): its proposed refund is not declined while
            // REQUESTED or while a provider call may have moved money. A CONFIRMED that sent
            // nothing can be declined (owner, option 1) and then answered by action 14.
            const closesHeldCharge =
                refund.status === 'REQUESTED' ||
                (await refundHasLiveProviderCalls({ tx, refundId: refund.id }));
            if (held?.held && closesHeldCharge)
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'The refund of a held page charge cannot be declined',
                    undefined,
                    'REFUND_CLOSES_HELD_CHARGE'
                );
        }
        if (
            refund.status === 'CONFIRMED' &&
            (await refundHasLiveProviderCalls({ tx, refundId: refund.id }))
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund has accepted or unanswered provider calls',
                undefined,
                'REFUND_HAS_PROVIDER_CALLS'
            );
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
        return refund.status === 'CONFIRMED'
            ? {
                  refundId: refund.id,
                  status: 'FAILED',
                  subjectId,
                  warning: 'VERIFY_NO_PROVIDER_REFUND'
              }
            : { refundId: refund.id, status: 'FAILED', subjectId };
    });
}
