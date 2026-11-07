import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    isNull,
    payments,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { emitArrearsSuspensionCoverageChanged } from './arrears-suspension-write';
import { readChargebackSuspensionNoticeContent } from './chargeback-suspension-notice';
import { type PauseComplementsSummary, pauseComplementsS32 } from './complement-pause-s32';
import type { ComplementPolicyPorts } from './complement-ports';
import type { BeforeCancelNotice } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type ScheduledChangeApplier
} from './subscription-billing-ports';
import { completeSuccessorCut } from './successor-cut-after-commit';
import type { SuccessorCutResult } from './successor-cutter';
import { writeChargebackSuspension } from './suspend-for-chargeback-write';

const logger = createLogger('suspend-for-chargeback');

/** Reuses S6's post-commit coverage removal for the chargeback event. */
async function emitCoverageChanged(input: {
    readonly row: {
        readonly id: string;
        readonly userId: string | null;
        readonly vertical: string | null;
    };
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    await emitArrearsSuspensionCoverageChanged(input);
}

/** S6's third event, distinct from the arrears events. */
export const PAYMENT_CHARGEBACK_OBSERVED = 'PAYMENT_CHARGEBACK_OBSERVED' as const;

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    paymentId: z.uuid(),
    occurrenceId: z.string().min(1)
});

/** A credited chargeback observed for one principal subscription. */
export interface SuspendForChargebackInput {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly occurrenceId: string;
}

/** S6's chargeback outcome; deferred calls leave the subscription in its origin. */
export type SuspendForChargebackResult =
    | {
          readonly outcome: 'SUSPENDED';
          readonly subscriptionId: string;
          readonly cancelCall: 'SENT' | 'NOT_NEEDED';
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
          readonly complements?: PauseComplementsSummary;
          readonly successorCut?: SuccessorCutResult;
      }
    | {
          readonly outcome: 'DEFERRED';
          readonly subscriptionId: string;
          readonly reason: 'NOTICE_NOT_SENT' | 'CANCEL_FAILED';
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'NO_SUBSCRIPTION'
              | 'NOT_IN_ORIGIN'
              | 'NOT_CARD_PRINCIPAL'
              | 'NOT_COURTESY_PAUSE'
              | 'LOST_RACE';
      };

/** Provider, notice, and transaction side-effect ports for chargeback S6. */
export interface SuspendForChargebackPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly coverageNotices?: CoverageNotices;
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    readonly complements?: ComplementPolicyPorts;
}

/**
 * S6 by its third event (AC:B7:10, AC:B7:33, AC:B7:27, DEC-SUB-020 📌1,
 * PROH:B:4). A chargeback immediately suspends a card principal in ACTIVE,
 * GRACE_PERIOD, or PAUSED courtesy, then calls S31 in the same transaction.
 * S19 retention and live succession are arrears guards: the chargeback bypasses
 * both, and S31 reevaluates a predecessor's retained payment.
 */
export async function suspendForChargeback(
    input: SuspendForChargebackInput,
    ports: SuspendForChargebackPorts
): Promise<SuspendForChargebackResult> {
    const value = inputSchema.parse(input);
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    if (!['ACTIVE', 'GRACE_PERIOD', 'PAUSED'].includes(subscription.status))
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_ORIGIN' };
    const origin = subscription.status as 'ACTIVE' | 'GRACE_PERIOD' | 'PAUSED';
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' };
    if (origin === 'PAUSED') {
        const [pause] = await getDb()
            .select({ reason: subscriptionPauses.reason })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, subscription.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (pause?.reason !== 'COURTESY')
            return { outcome: 'NOT_APPLICABLE', reason: 'NOT_COURTESY_PAUSE' };
    }
    const [payment] = await getDb()
        .select()
        .from(payments)
        .where(and(eq(payments.id, value.paymentId), eq(payments.subscriptionId, subscription.id)))
        .limit(1);
    if (!payment || !['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_ORIGIN' };
    const content = await readChargebackSuspensionNoticeContent({
        subscription,
        payment,
        courtesyEnded: origin === 'PAUSED',
        now: ports.clock.now()
    });

    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    const rereadAuthorization = async () => {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: providerLink.providerId
        });
        const { snapshot, readAt } = assertFreshForAct({ read, act });
        return { status: snapshot.status, readAt };
    };
    const authorization = await rereadAuthorization();
    let cancelCall: 'SENT' | 'NOT_NEEDED';
    let escalated: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED' | undefined;
    if (authorization.status === 'cancelled') {
        await recordCancellationSeen({
            annotator,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
        cancelCall = 'NOT_NEEDED';
        // H2: a prior provider cancellation has no call for the notice to precede.
        try {
            const notice = await ports.beforeCancelNotice.beforeCancel({
                subscriptionId: subscription.id,
                userId: subscription.userId ?? '',
                kind: 'CHARGEBACK_SUSPENSION',
                occurrenceId: value.occurrenceId,
                content
            });
            if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
                logger.warn(
                    { subscriptionId: subscription.id, notice },
                    'Chargeback notice is not deliverable'
                );
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Chargeback notice could not be enqueued'
            );
        }
    } else {
        await recordAuthorizationSeenAlive({
            annotator,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: subscription.id,
            userId: subscription.userId ?? '',
            kind: 'CHARGEBACK_SUSPENSION',
            occurrenceId: value.occurrenceId,
            content
        });
        if (notice === 'NOT_YET_SENT')
            return {
                outcome: 'DEFERRED',
                subscriptionId: subscription.id,
                reason: 'NOTICE_NOT_SENT'
            };
        if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
            escalated = notice;
            logger.warn(
                { subscriptionId: subscription.id, notice },
                'Chargeback notice is not deliverable; cancelling anyway'
            );
        }
        try {
            await ports.provider.cancel({ authorizationId: providerLink.providerId });
        } catch (error) {
            logger.error(
                {
                    subscriptionId: subscription.id,
                    authorizationId: providerLink.providerId,
                    error
                },
                'Chargeback cancellation failed; S6 deferred'
            );
            return {
                outcome: 'DEFERRED',
                subscriptionId: subscription.id,
                reason: 'CANCEL_FAILED'
            };
        }
        cancelCall = 'SENT';
        try {
            const confirmed = await rereadAuthorization();
            if (confirmed.status === 'cancelled')
                await recordCancellationSeen({
                    annotator,
                    subscriptionId: subscription.id,
                    seenAt: confirmed.readAt
                });
            else
                await recordAuthorizationSeenAlive({
                    annotator,
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
                'Could not confirm chargeback cancellation'
            );
        }
    }

    const write = await writeChargebackSuspension({
        subscriptionId: subscription.id,
        origin,
        now: ports.clock.now(),
        readAt: authorization.readAt,
        clock: ports.clock,
        orphanhood: ports.orphanhood
    });
    if (write.kind !== 'SUSPENDED') return { outcome: 'NOT_APPLICABLE', reason: write.kind };
    try {
        await emitCoverageChanged({
            row: write.row,
            coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
        });
    } catch (error) {
        logger.error(
            { subscriptionId: subscription.id, error },
            'Coverage notice failed after chargeback S6'
        );
    }
    try {
        await completeSuccessorCut(write.cut, ports);
    } catch (error) {
        logger.error(
            { subscriptionId: subscription.id, error },
            'S31 completion failed after chargeback S6'
        );
    }
    let complements: PauseComplementsSummary | undefined;
    if (ports.complements) {
        try {
            complements = await pauseComplementsS32(
                { principalSubscriptionId: subscription.id, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: ports.provider, clock: ports.clock, policy: ports.complements }
            );
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'S32 failed after chargeback S6'
            );
        }
    }
    return {
        outcome: 'SUSPENDED',
        subscriptionId: subscription.id,
        cancelCall,
        successorCut: write.cut,
        ...(complements === undefined ? {} : { complements }),
        ...(escalated ? { escalated } : {})
    };
}
