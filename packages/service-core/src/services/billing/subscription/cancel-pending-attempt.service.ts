import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    findPendingAttemptById,
    getDb,
    reconciliationInventoryModel,
    subscriptionModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { type BillingFactSink, emitBillingFact } from '../facts/billing-fact-sink.js';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import { reevaluateRetainedPayments } from './expire-authorization-windows.service.js';
import { commitmentTaken, previousAttemptInProgress } from './resolve-live-commitment.js';
import type { BeforeCancelNotice } from './start-subscription.service.js';
import { releaseCancelledSuccessionPredecessor } from './succession-cancel-writes.js';

const logger = createLogger('cancel-pending-attempt');

/** Optional S5/S7 ports used when S40 re-evaluates the payments S19 retained on a predecessor. */
export type CancelPendingAttemptRetainedPaymentPorts = Partial<
    Pick<
        Parameters<typeof reevaluateRetainedPayments>[1],
        'coverageNotices' | 'scheduledChangeApplier' | 'complements'
    >
>;

/**
 * S40 (HOS-1735): let the person abandon their own pending card signup and release its vertical commitment.
 * It is distinct from S39 because S39 means restarting the same option and uses its replacement notice.
 * Since HOS-2344 it also abandons a pending successor (a plan change whose checkout was left open):
 * the predecessor's `succeeded_by_id` goes back to NULL in the same transaction, its deferred
 * courtesy stays open, and the payments S19 retained on it are re-evaluated as in S3.
 */
export async function cancelPendingAttempt(
    input: { readonly subscriptionId: string; readonly userId: string },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly beforeCancelNotice: BeforeCancelNotice;
        readonly billingFacts?: BillingFactSink;
        readonly retainedPayments?: CancelPendingAttemptRetainedPaymentPorts;
    }
): Promise<{
    readonly subscriptionId: string;
    readonly outcome: 'ABANDONED' | 'ALREADY_ABANDONED';
}> {
    const candidate = await findPendingAttemptById({ subscriptionId: input.subscriptionId });
    if (!candidate || candidate.subscription.userId !== input.userId)
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
    if (candidate.subscription.status === 'ABANDONED')
        return { subscriptionId: input.subscriptionId, outcome: 'ALREADY_ABANDONED' };
    if (
        candidate.subscription.status !== 'PENDING_AUTHORIZATION' ||
        candidate.subscription.class !== 'PRINCIPAL'
    )
        throw commitmentTaken();
    // HOS-2344: a pending successor is cancellable too; its predecessor is released below.
    const predecessorId = candidate.subscription.succeedsId;
    const link = candidate.providerLink;
    if (!link || !candidate.idempotencyKey || candidate.idempotencyKey.completedAt === null)
        throw previousAttemptInProgress();

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId: link.providerId });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.reference !== candidate.subscription.id) {
        logger.error(
            { subscriptionId: candidate.subscription.id },
            'Cancellation read reference did not match the subscription'
        );
        throw commitmentTaken();
    }
    if (snapshot.status !== 'pending' && snapshot.status !== 'cancelled') throw commitmentTaken();

    const now = ports.clock.now();
    const writeResult = await getDb().transaction(async (tx) => {
        const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
            subscriptionId: candidate.subscription.id,
            tx
        });
        if (
            locked?.subscription.status !== 'PENDING_AUTHORIZATION' ||
            locked.providerLink?.providerId !== link.providerId
        ) {
            return locked?.subscription.status === 'ABANDONED' ? 'ALREADY_ABANDONED' : 'CONFLICT';
        }
        const changed = await subscriptionModel.abandonReplacedPendingAuthorization({
            subscriptionId: candidate.subscription.id,
            now,
            tx,
            ...(predecessorId === null ? {} : { predecessorId })
        });
        if (!changed.wrote) return 'CONFLICT';
        const release =
            predecessorId === null
                ? { released: false }
                : await releaseCancelledSuccessionPredecessor({
                      predecessorId,
                      successorId: candidate.subscription.id,
                      now,
                      tx
                  });
        await recordProviderCancellationDecided({
            subscriptionId: candidate.subscription.id,
            transition: 'S40',
            decidedAt: now,
            actor: { type: 'owner', id: input.userId },
            correlationId: randomUUID(),
            changes: [
                { field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' },
                ...(release.released
                    ? [
                          {
                              field: 'predecessor.succeededById',
                              old: candidate.subscription.id,
                              new: null
                          }
                      ]
                    : [])
            ],
            tx
        });
        return 'ABANDONED';
    });
    if (writeResult === 'CONFLICT') throw commitmentTaken();
    if (writeResult === 'ALREADY_ABANDONED')
        return { subscriptionId: input.subscriptionId, outcome: 'ALREADY_ABANDONED' };

    if (
        candidate.subscription.userId &&
        candidate.subscription.class === 'PRINCIPAL' &&
        candidate.subscription.vertical
    ) {
        const vertical = VerticalEnumSchema.safeParse(candidate.subscription.vertical);
        if (vertical.success)
            emitBillingFact({
                sink: ports.billingFacts,
                fact: {
                    kind: 'CHECKOUT_ABANDONED',
                    userId: candidate.subscription.userId,
                    vertical: vertical.data,
                    subscriptionId: candidate.subscription.id,
                    subscriptionClass: 'PRINCIPAL',
                    actorKind: 'USER',
                    reason: 'USER_CANCELLED',
                    secondsInPending: Math.max(
                        0,
                        Math.floor(
                            (now.getTime() - candidate.subscription.createdAt.getTime()) / 1000
                        )
                    ),
                    occurredAt: now
                }
            });
    }

    if (snapshot.status === 'pending') {
        const { outcome } = await cancelOurAuthorization(
            {
                subscriptionId: candidate.subscription.id,
                userId: input.userId,
                authorizationId: link.providerId,
                kind: 'ATTEMPT_CANCELLED',
                prior: { read, act }
            },
            ports
        );
        if (outcome !== 'CONFIRMED' && outcome !== 'ALREADY_CANCELLED')
            logger.warn(
                { subscriptionId: candidate.subscription.id, outcome },
                'Cancelled authorization will be retried by the sweep'
            );
    }
    // HOS-2344: the succession is over, as in S3 — re-evaluate what S19 retained on the predecessor.
    if (predecessorId !== null)
        await reevaluateRetainedPayments(
            { predecessorId },
            {
                provider: ports.provider,
                clock: ports.clock,
                ...(ports.billingFacts ? { billingFacts: ports.billingFacts } : {}),
                ...ports.retainedPayments
            }
        );
    return { subscriptionId: input.subscriptionId, outcome: 'ABANDONED' };
}
