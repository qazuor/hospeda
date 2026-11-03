import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization.js';
import {
    cancelSuccessionPredecessorInputSchema,
    closeSuccessionPredecessorPause,
    readPredecessorAuthorizationId,
    readSuccessionPredecessor,
    writeSuccessionPredecessorCancellation
} from './cancel-succession-predecessor-support.js';
import type { BeforeCancelNotice } from './start-subscription.service.js';
import type { SuccessionCloser } from './subscription-billing-ports.js';
import { closeSuccessionIfPredecessor } from './succession-end.js';

const logger = createLogger('cancel-succession-predecessor');
const LIVE_PREDECESSOR = new Set([
    'ACTIVE',
    'GRACE_PERIOD',
    'CANCEL_SCHEDULED',
    'PAUSED',
    'SUSPENDED'
]);

/** Ports of the standalone S17 act. */
export interface CancelSuccessionPredecessorPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly successionCloser: SuccessionCloser;
    readonly coverageNotices?: CoverageNotices;
}

/** Typed S17 outcome, including retryable provider and notice failures. */
export type CancelSuccessionPredecessorResult =
    | {
          readonly outcome: 'CANCELLED';
          readonly providerCall: 'CONFIRMED' | 'ALREADY_CANCELLED' | 'NONE';
          readonly pauseClosed: boolean;
          readonly noticeUndeliverable: boolean;
      }
    | {
          readonly outcome: 'DEFERRED';
          readonly reason: 'NOTICE_PENDING' | 'CALL_FAILED' | 'SENT_UNCONFIRMED';
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'SUCCESSOR_NOT_AUTHORIZED'
              | 'SUCCESSOR_NOT_CONFIRMED'
              | 'PREDECESSOR_NOT_LIVE'
              | 'NO_SUCCESSION';
      }
    | { readonly outcome: 'LOST_RACE' };

/**
 * TRANS:B:S17, AC:B8b:9, INV:D7, DEC-MAIL-001: confirm successor authorization,
 * send our notice before cancelling the predecessor authorization, and write S17 with
 * S18 in one transaction. D-7 leaves failed or unconfirmed calls for state reevaluation;
 * D-8 keeps this act out of the cancellation sweep.
 */
export async function cancelSuccessionPredecessor(
    input: { readonly successorSubscriptionId: string },
    ports: CancelSuccessionPredecessorPorts
): Promise<CancelSuccessionPredecessorResult> {
    const { successorSubscriptionId } = cancelSuccessionPredecessorInputSchema.parse(input);
    const { successor, predecessor, successorLink } = await readSuccessionPredecessor({
        successorSubscriptionId
    });
    if (!successor?.predecessorId || !predecessor)
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUCCESSION' };
    if (successor.status !== 'ACTIVE')
        return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_AUTHORIZED' };
    if (!LIVE_PREDECESSOR.has(predecessor.status)) {
        await getDb().transaction(async (tx) => {
            await closeSuccessionIfPredecessor(
                { predecessorSubscriptionId: predecessor.id, tx },
                { successionCloser: ports.successionCloser }
            );
        });
        return { outcome: 'NOT_APPLICABLE', reason: 'PREDECESSOR_NOT_LIVE' };
    }
    if (!successorLink?.providerId)
        return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_CONFIRMED' };
    try {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: successorLink.providerId
        });
        if (assertFreshForAct({ read, act }).snapshot.status !== 'active')
            return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_CONFIRMED' };
    } catch (error) {
        logger.error({ successorSubscriptionId, error }, 'S17 successor authorization read failed');
        return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_CONFIRMED' };
    }

    let providerCall: 'CONFIRMED' | 'ALREADY_CANCELLED' | 'NONE' = 'NONE';
    let noticeUndeliverable = false;
    if (predecessor.paymentMethod === 'CARD') {
        const { authorizationId } = await readPredecessorAuthorizationId({
            subscriptionId: predecessor.id
        });
        if (authorizationId) {
            const beforeCancelNotice: BeforeCancelNotice = {
                async beforeCancel(args) {
                    const status = await ports.beforeCancelNotice.beforeCancel(args);
                    if (status === 'NO_RECIPIENT' || status === 'DELIVERY_EXHAUSTED') {
                        noticeUndeliverable = true;
                        logger.error(
                            { subscriptionId: predecessor.id, status },
                            'S17 before-cancel notice is undeliverable',
                            { capture: true }
                        );
                    }
                    return status;
                }
            };
            const { outcome } = await cancelOurAuthorization(
                {
                    subscriptionId: predecessor.id,
                    userId: predecessor.userId,
                    authorizationId,
                    kind: 'SUCCESSION_PREDECESSOR'
                },
                { provider: ports.provider, clock: ports.clock, beforeCancelNotice }
            );
            if (
                outcome === 'NOTICE_PENDING' ||
                outcome === 'CALL_FAILED' ||
                outcome === 'SENT_UNCONFIRMED'
            )
                return { outcome: 'DEFERRED', reason: outcome };
            providerCall = outcome;
        }
    }

    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [locked] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, predecessor.id))
            .limit(1)
            .for('update');
        if (locked?.status !== predecessor.status) return { outcome: 'LOST_RACE' as const };
        const written = await writeSuccessionPredecessorCancellation({
            tx,
            subscriptionId: predecessor.id,
            observedStatus: predecessor.status,
            now
        });
        if (!written) return { outcome: 'LOST_RACE' as const };
        const pauseClosed =
            predecessor.status === 'PAUSED'
                ? await closeSuccessionPredecessorPause({ tx, subscriptionId: predecessor.id, now })
                : false;
        if (predecessor.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: predecessor.userId,
                vertical: predecessor.vertical ?? '',
                lostAt: now,
                clock: ports.clock
            });
        await closeSuccessionIfPredecessor(
            { predecessorSubscriptionId: predecessor.id, tx },
            { successionCloser: ports.successionCloser }
        );
        return { outcome: 'CANCELLED' as const, pauseClosed };
    });
    if (committed.outcome === 'LOST_RACE') return committed;
    const vertical = VerticalEnumSchema.safeParse(predecessor.vertical);
    if (ports.coverageNotices && predecessor.userId && vertical.success) {
        try {
            await ports.coverageNotices.emitCoverageChanged({
                userId: predecessor.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error({ subscriptionId: predecessor.id, error }, 'S17 coverage notice failed');
        }
    }
    return {
        outcome: 'CANCELLED',
        providerCall,
        pauseClosed: committed.pauseClosed,
        noticeUndeliverable
    };
}
