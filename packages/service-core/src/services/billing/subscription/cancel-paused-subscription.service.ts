import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { type CancellationReasonSchema, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import { cancelAddonComplementsAtProvider, runOrphanhood } from '../addon/addon-instance-a5.js';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import { cancelActiveRejection } from './cancel-active-subscription.service.js';
import {
    CANCEL_PAUSED_CALL_BY_OUTCOME,
    type CancelPausedProviderResult,
    type CancelPausedReading,
    type CancelPausedSubscriptionPorts,
    type CancelPausedSubscriptionResult,
    cancelPausedInputSchema,
    closeOpenPause,
    emitPausedAddonCoverageRemoved,
    markPausedCancellationLostRace,
    observePausedBeforeCancelNotice,
    readOpenPauseId,
    readPausedAuthorizationForAct,
    readPausedCancellationIdempotency,
    writePausedCancellation,
    writePausedScheduledCancellation
} from './cancel-paused-subscription-support.js';
import { resolveCancellationAuthority } from './cancellation-authorization.js';
import {
    cancelComplementsByS11Rule,
    cancelDecidedComplementsAtProvider
} from './complement-s11-rule.js';
import { computeS11ServiceEnd, readS11ServiceEndFacts } from './s11-service-end.js';
import {
    noCancellationSeenAnnotation,
    recordCancellationSeen,
    unimplementedSuccessionCloser
} from './subscription-billing-ports.js';
import { findSubscriptionProhibition } from './subscription-prohibited-transitions.js';
import { closeSuccessionIfPredecessor } from './succession-end.js';

const logger = createLogger('cancel-paused-subscription-s22');

/** Executes S22 from PAUSED, preserving unconsumed successor credit through S11's full rule. */
export async function cancelPausedSubscription(
    input: {
        readonly actor: Actor;
        readonly subscriptionId: string;
        readonly reason?: z.infer<typeof CancellationReasonSchema>;
    },
    ports: CancelPausedSubscriptionPorts
): Promise<CancelPausedSubscriptionResult> {
    const parsed = cancelPausedInputSchema.parse(input);
    if (!z.uuid().safeParse(parsed.subscriptionId).success)
        throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [row] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, parsed.subscriptionId))
            .limit(1)
            .for('update');
        if (!row) throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        const authority = resolveCancellationAuthority({
            actor: parsed.actor,
            subjectUserId: row.userId
        });
        if (!authority.allowed) {
            if (authority.reason === 'FORBIDDEN')
                throw cancelActiveRejection('CANCELLATION_FORBIDDEN', 'Cancellation is forbidden');
            throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        if (row.class !== 'PRINCIPAL')
            throw cancelActiveRejection(
                'CANCELLATION_NOT_PRINCIPAL',
                'Only principal subscriptions can be cancelled'
            );
        const already = await readPausedCancellationIdempotency({
            tx,
            subscriptionId: row.id,
            status: row.status,
            serviceEndsAt: row.serviceEndsAt
        });
        if (already) return already;
        if (row.status !== 'PAUSED')
            return { state: 'REJECTED' as const, reason: 'NOT_PAUSED' as const };
        const pauseId = await readOpenPauseId({ tx, subscriptionId: row.id });
        if (!pauseId) return { state: 'REJECTED' as const, reason: 'NO_OPEN_PAUSE' as const };
        const facts = await readS11ServiceEndFacts({ tx, subscription: row });
        const credited = facts.creditEndsAt !== null && facts.creditEndsAt > now;
        const end = credited ? computeS11ServiceEnd({ now, ...facts }) : null;
        if (
            credited &&
            findSubscriptionProhibition({
                from: 'PAUSED',
                to: 'CANCEL_SCHEDULED',
                exception: 'S22_UNCONSUMED_CREDIT'
            }) !== null
        )
            throw new Error('S22 credit exception is prohibited');
        const written =
            credited && end
                ? await writePausedScheduledCancellation({
                      tx,
                      subscriptionId: row.id,
                      now,
                      serviceEndsAt: end.serviceEndsAt,
                      reason: parsed.reason
                  })
                : await writePausedCancellation({
                      tx,
                      subscriptionId: row.id,
                      now,
                      reason: parsed.reason
                  });
        if (!written) return { state: 'LOST_RACE' as const };
        await closeOpenPause({ tx, pauseId, now });
        const decided = credited
            ? (
                  await cancelComplementsByS11Rule(
                      { tx, principalSubscriptionId: row.id, now },
                      ports.complements
                  )
              ).decided
            : [];
        const [link] = await tx
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.id))
            .limit(1);
        const cardPayer = row.paymentMethod === 'CARD';
        if (cardPayer && link) {
            const actor = {
                type: authority.as === 'OWNER' ? ('owner' as const) : ('admin' as const),
                id: parsed.actor.id
            };
            if (credited)
                await recordProviderCancellationDecided({
                    subscriptionId: row.id,
                    transition: 'S11',
                    decidedAt: now,
                    actor,
                    correlationId: crypto.randomUUID(),
                    changes: [{ field: 'status', old: 'PAUSED', new: 'CANCEL_SCHEDULED' }],
                    tx
                });
            else
                await recordProviderCancellationDecided({
                    subscriptionId: row.id,
                    transition: 'S22',
                    decidedAt: now,
                    actor,
                    correlationId: crypto.randomUUID(),
                    changes: [{ field: 'status', old: 'PAUSED', new: 'CANCELLED' }],
                    tx
                });
        } else if (cardPayer)
            logger.error({ subscriptionId: row.id }, 'S22 card subscription has no provider link');
        let successionClosed = false;
        let cancelled: Awaited<ReturnType<typeof runOrphanhood>>['cancelled'] = [];
        if (!credited) {
            successionClosed = (
                await closeSuccessionIfPredecessor(
                    { predecessorSubscriptionId: row.id, tx },
                    { successionCloser: ports.successionCloser ?? unimplementedSuccessionCloser }
                )
            ).called;
            cancelled = (await runOrphanhood({ tx, subscriptionId: row.id, now }, ports.orphanhood))
                .cancelled;
            if (row.userId)
                await recordCoverageLossIfUncovered({
                    tx,
                    userId: row.userId,
                    vertical: row.vertical ?? '',
                    lostAt: now,
                    clock: ports.clock
                });
        }
        return {
            state: credited ? ('SCHEDULED' as const) : ('CANCELLED' as const),
            reading: {
                subscriptionId: row.id,
                userId: row.userId,
                vertical: row.vertical,
                cardPayer,
                authorizationId: link?.providerId ?? null,
                kind: credited
                    ? ('SCHEDULED_CANCELLATION' as const)
                    : ('DIRECT_CANCELLATION' as const)
            } satisfies CancelPausedReading,
            serviceEndsAt: end?.serviceEndsAt ?? now,
            basis: end?.basis ?? ('NOW' as const),
            decided,
            cancelled,
            successionClosed
        };
    });
    if (committed.state === 'ALREADY_CANCELLED')
        return { outcome: 'ALREADY_CANCELLED', serviceEndsAt: committed.serviceEndsAt };
    if (committed.state === 'ALREADY_SCHEDULED')
        return { outcome: 'ALREADY_SCHEDULED', serviceEndsAt: committed.serviceEndsAt };
    if (committed.state === 'REJECTED') return { outcome: 'REJECTED', reason: committed.reason };
    if (committed.state === 'LOST_RACE') {
        await markPausedCancellationLostRace({
            subscriptionId: parsed.subscriptionId,
            actorId: parsed.actor.id
        });
        return { outcome: 'LOST_RACE' };
    }
    const { reading } = committed;
    const vertical = VerticalEnumSchema.safeParse(reading.vertical);
    if (reading.userId && vertical.success) {
        try {
            await ports.coverageNotices.emitCoverageChanged({
                userId: reading.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: committed.state === 'SCHEDULED' ? 'CHANGED' : 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: reading.subscriptionId, error },
                'S22 coverage notice failed'
            );
        }
    }
    const providerResult = await cancelAtProvider(reading, ports);
    if (committed.state === 'SCHEDULED') {
        let calls: Awaited<ReturnType<typeof cancelDecidedComplementsAtProvider>>['results'] = [];
        try {
            calls = (
                await cancelDecidedComplementsAtProvider(
                    { decided: committed.decided },
                    {
                        provider: ports.provider,
                        clock: ports.clock,
                        beforeCancelNotice: ports.beforeCancelNotice,
                        cancellationSeen: ports.cancellationSeen
                    }
                )
            ).results;
        } catch (error) {
            logger.error(
                { subscriptionId: reading.subscriptionId, error },
                'S22 complement cancellation failed'
            );
        }
        return {
            outcome: 'SCHEDULED',
            serviceEndsAt: committed.serviceEndsAt,
            basis: committed.basis,
            cancelCall: providerResult.cancelCall,
            complements: { decided: committed.decided.length, calls },
            ...(providerResult.escalated ? { escalated: providerResult.escalated } : {})
        };
    }
    await emitPausedAddonCoverageRemoved({
        subscriptionId: reading.subscriptionId,
        cancelled: committed.cancelled,
        coverageNotices: ports.coverageNotices
    });
    let addonCancelCalls: Awaited<ReturnType<typeof cancelAddonComplementsAtProvider>>['results'] =
        [];
    try {
        addonCancelCalls = (
            await cancelAddonComplementsAtProvider(
                { cancelled: committed.cancelled },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    beforeCancelNotice: ports.beforeCancelNotice,
                    cancellationSeen: ports.cancellationSeen
                }
            )
        ).results;
    } catch (error) {
        logger.error(
            { subscriptionId: reading.subscriptionId, error },
            'S22 addon cancellation failed'
        );
    }
    return {
        outcome: 'CANCELLED',
        serviceEndsAt: committed.serviceEndsAt,
        cancelCall: providerResult.cancelCall,
        successionClosed: committed.successionClosed,
        orphanedAddonIds: committed.cancelled.map(({ instanceId }) => instanceId),
        addonCancelCalls,
        ...(providerResult.escalated ? { escalated: providerResult.escalated } : {})
    };
}

async function cancelAtProvider(
    reading: CancelPausedReading,
    ports: CancelPausedSubscriptionPorts
): Promise<CancelPausedProviderResult> {
    if (!reading.cardPayer || !reading.authorizationId) return { cancelCall: 'NOT_APPLICABLE' };
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    try {
        const { read, act } = await readPausedAuthorizationForAct({ reading, ports });
        const observed = observePausedBeforeCancelNotice(ports.beforeCancelNotice);
        const shared = {
            subscriptionId: reading.subscriptionId,
            userId: reading.userId,
            authorizationId: reading.authorizationId,
            prior: { read, act }
        };
        const cancellationPorts = {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: observed.beforeCancelNotice
        };
        const { outcome } =
            reading.kind === 'DIRECT_CANCELLATION'
                ? await cancelOurAuthorization(
                      { ...shared, kind: 'DIRECT_CANCELLATION' },
                      cancellationPorts
                  )
                : await cancelOurAuthorization(
                      { ...shared, kind: 'SCHEDULED_CANCELLATION' },
                      cancellationPorts
                  );
        if (outcome === 'CONFIRMED')
            await recordCancellationSeen({
                annotator,
                subscriptionId: reading.subscriptionId,
                seenAt: ports.clock.now()
            });
        const cancelCall = CANCEL_PAUSED_CALL_BY_OUTCOME[outcome];
        const notice = observed.status();
        const escalated =
            cancelCall !== 'NOTICE_PENDING' &&
            (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
                ? notice
                : undefined;
        return { cancelCall, ...(escalated ? { escalated } : {}) };
    } catch (error) {
        logger.error(
            {
                subscriptionId: reading.subscriptionId,
                authorizationId: reading.authorizationId,
                error
            },
            'S22 provider cancellation failed after commit'
        );
        return { cancelCall: 'FAILED' };
    }
}
