import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { isSuccessorOfPayingPredecessor } from './paying-predecessor-successor';
import { enqueueSignupDeclinedNotice } from './signup-declined-notice';
import type { BeforeCancelNotice } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    noCreditedPayments,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type SubscriptionPayments,
    type SuccessionCloser,
    unimplementedSuccessionCloser
} from './subscription-billing-ports';

const logger = createLogger('decline-first-charge');

const DeclineFirstChargeInputSchema = z.strictObject({ chargeId: z.string().min(1) });

export type DeclineFirstChargeResult =
    | {
          readonly outcome: 'DECLINED';
          readonly subscriptionId: string;
          readonly cancelCall: 'SENT' | 'FAILED' | 'DEFERRED' | 'NOT_NEEDED';
          readonly successionClosed: boolean;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'CHARGE_NOT_REJECTED'
              | 'NO_SUBSCRIPTION'
              | 'NOT_ACTIVE'
              | 'AUTHORIZATION_NOT_CANCELLED'
              | 'HAS_CREDITED_PAYMENT'
              | 'LEFT_TO_S4'
              | 'LOST_RACE';
      };

export interface DeclineFirstChargePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly payments?: SubscriptionPayments;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    /** Receives the post-commit `REMOVED` notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
}

/**
 * S16 closes a signup after its first rejected charge. For HOS-1731, a pending signup
 * enters only when its authorization has already been read as cancelled, because cancelling
 * a live checkout could destroy a successful retry. Active signups retain the existing path.
 * `CHARGE_DECLINED` emits no coverage source, so active coverage removal is notified after commit.
 */
export async function declineFirstCharge(
    input: { readonly chargeId: string },
    ports: DeclineFirstChargePorts
): Promise<DeclineFirstChargeResult> {
    const value = DeclineFirstChargeInputSchema.parse(input);
    const payments = ports.payments ?? noCreditedPayments;
    const successionCloser = ports.successionCloser ?? unimplementedSuccessionCloser;

    const chargeAct = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act: chargeAct });
    const chargeRead = await ports.provider.readCharge({ chargeId: value.chargeId });
    const { snapshot: charge } = assertFreshForAct({ read: chargeRead, act: chargeAct });
    if (charge.status !== 'rejected')
        return { outcome: 'NOT_APPLICABLE', reason: 'CHARGE_NOT_REJECTED' };
    if (charge.authorizationId === null)
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    const sourceStatus = subscription.status;
    const isPendingSignup = sourceStatus === 'PENDING_AUTHORIZATION';
    if ((sourceStatus !== 'ACTIVE' && !isPendingSignup) || subscription.class !== 'PRINCIPAL')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_ACTIVE' };

    if (await payments.hasCreditedPayment({ subscriptionId: subscription.id }))
        return { outcome: 'NOT_APPLICABLE', reason: 'HAS_CREDITED_PAYMENT' };
    // The successor of a paying predecessor belongs to S4 (AC:B7:4, DEC-SUB-022), read by the
    // same predicate S4 uses; every other successor dies here as a signup.
    if (await isSuccessorOfPayingPredecessor({ subscription, payments }))
        return { outcome: 'NOT_APPLICABLE', reason: 'LEFT_TO_S4' };

    const rereadAuthorization = async () => {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: providerLink.providerId
        });
        const fresh = assertFreshForAct({ read, act });
        return { status: fresh.snapshot.status, readAt: fresh.readAt };
    };

    const authorization = await rereadAuthorization();
    if (isPendingSignup && authorization.status !== 'cancelled')
        return { outcome: 'NOT_APPLICABLE', reason: 'AUTHORIZATION_NOT_CANCELLED' };
    let cancelCall: 'SENT' | 'FAILED' | 'DEFERRED' | 'NOT_NEEDED';
    if (authorization.status === 'cancelled') {
        await recordCancellationSeen({
            annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
        cancelCall = 'NOT_NEEDED';
    } else {
        await recordAuthorizationSeenAlive({
            annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: subscription.id,
            userId: subscription.userId ?? '',
            kind: 'FIRST_CHARGE_DECLINED'
        });
        if (notice === 'NOT_YET_SENT') {
            cancelCall = 'DEFERRED';
        } else {
            if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
                logger.warn(
                    { subscriptionId: subscription.id, notice },
                    'Before-cancel notice is not deliverable'
                );
            }
            try {
                await ports.provider.cancel({ authorizationId: providerLink.providerId });
                cancelCall = 'SENT';
            } catch (error) {
                logger.error(
                    {
                        subscriptionId: subscription.id,
                        authorizationId: providerLink.providerId,
                        error
                    },
                    'Declined signup authorization could not be cancelled'
                );
                cancelCall = 'FAILED';
            }
        }
    }

    if (cancelCall === 'SENT') {
        try {
            const confirmed = await rereadAuthorization();
            if (confirmed.status === 'cancelled')
                await recordCancellationSeen({
                    annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                    subscriptionId: subscription.id,
                    seenAt: confirmed.readAt
                });
            else
                await recordAuthorizationSeenAlive({
                    annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                    subscriptionId: subscription.id,
                    seenAt: confirmed.readAt
                });
        } catch (error) {
            logger.error(
                {
                    subscriptionId: subscription.id,
                    authorizationId: providerLink.providerId,
                    error
                },
                'Could not confirm declined signup authorization cancellation'
            );
        }
    }

    const declined = await getDb().transaction(async (tx) => {
        const declinedAt = ports.clock.now();
        const [updated] = await tx
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED', updatedAt: declinedAt })
            .where(
                and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, sourceStatus))
            )
            .returning();
        if (!updated) return null;
        // S16 decided the cancellation; with the re-read already `cancelled` there was no call to
        // confirm, so only a sent, failed or deferred call enters the sweep's retry (AC:B11:6).
        if (cancelCall !== 'NOT_NEEDED') {
            await recordProviderCancellationDecided({
                subscriptionId: subscription.id,
                transition: 'S16',
                decidedAt: declinedAt,
                actor: { type: 'provider' },
                correlationId: randomUUID(),
                changes: [{ field: 'status', old: sourceStatus, new: 'CHARGE_DECLINED' }],
                tx
            });
        }
        const subject = { userId: updated.userId, vertical: updated.vertical };
        const [successor] = await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.succeedsId, subscription.id),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
                )
            )
            .limit(1);
        await enqueueSignupDeclinedNotice({
            tx,
            subscription: updated,
            declineReason: charge.declineReason,
            successionPredecessor: Boolean(successor)
        });
        if (successor)
            await successionCloser.closeSuccession({
                predecessorSubscriptionId: subscription.id,
                tx
            });
        // coberturaPerdidaEn in the same transaction as the drop (contract §4.1; I-5).
        if (sourceStatus === 'ACTIVE' && updated.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: updated.userId,
                vertical: updated.vertical ?? '',
                lostAt: declinedAt,
                clock: ports.clock
            });
        return { successionClosed: Boolean(successor), subject };
    });
    if (declined === null) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };

    const vertical = VerticalEnumSchema.safeParse(declined.subject.vertical);
    if (sourceStatus === 'ACTIVE' && declined.subject.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                userId: declined.subject.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Coverage changed notice failed after charge-declined commit'
            );
        }
    } else if (sourceStatus === 'ACTIVE') {
        logger.error(
            { subscriptionId: subscription.id, vertical: declined.subject.vertical },
            'Charge-declined subscription has no coverage subject to notify'
        );
    }
    return {
        outcome: 'DECLINED',
        subscriptionId: subscription.id,
        cancelCall,
        successionClosed: declined.successionClosed
    };
}
