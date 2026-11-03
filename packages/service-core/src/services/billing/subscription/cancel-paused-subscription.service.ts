import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    desc,
    domainEvent,
    eq,
    getDb,
    isNull,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { CancellationReasonSchema, PermissionEnum, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved,
    runOrphanhood
} from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import {
    type CancelActiveCall,
    cancelActiveRejection
} from './cancel-active-subscription.service.js';
import {
    type CancelPausedSubscriptionResult,
    closeOpenPause,
    writePausedCancellation,
    writePausedScheduledCancellation
} from './cancel-paused-subscription-support.js';
import { resolveCancellationAuthority } from './cancellation-authorization.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import {
    cancelComplementsByS11Rule,
    cancelDecidedComplementsAtProvider
} from './complement-s11-rule.js';
import { computeS11ServiceEnd, readS11ServiceEndFacts } from './s11-service-end.js';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type SuccessionCloser,
    unimplementedSuccessionCloser
} from './subscription-billing-ports.js';
import { findSubscriptionProhibition } from './subscription-prohibited-transitions.js';
import { closeSuccessionIfPredecessor } from './succession-end.js';

const logger = createLogger('cancel-paused-subscription-s22');
const actorSchema = z.custom<Actor>((value) => {
    if (typeof value !== 'object' || value === null) return false;
    const actor = value as { readonly id?: unknown; readonly permissions?: unknown };
    return (
        z.uuid().safeParse(actor.id).success &&
        z.array(z.nativeEnum(PermissionEnum)).safeParse(actor.permissions).success
    );
});
const inputSchema = z.strictObject({
    actor: actorSchema,
    subscriptionId: z.string(),
    reason: CancellationReasonSchema.optional()
});
const CALL_BY_OUTCOME: Readonly<Record<CancelOurAuthorizationOutcome, CancelActiveCall>> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/** Ports for both the immediate and credited S22 cancellations. */
export interface CancelPausedSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly complements: ComplementPolicyPorts;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}
interface Reading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly cardPayer: boolean;
    readonly authorizationId: string | null;
    readonly kind: 'DIRECT_CANCELLATION' | 'SCHEDULED_CANCELLATION';
}

/** Executes S22 from PAUSED, preserving unconsumed successor credit through S11's full rule. */
export async function cancelPausedSubscription(
    input: {
        readonly actor: Actor;
        readonly subscriptionId: string;
        readonly reason?: z.infer<typeof CancellationReasonSchema>;
    },
    ports: CancelPausedSubscriptionPorts
): Promise<CancelPausedSubscriptionResult> {
    const parsed = inputSchema.parse(input);
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
        if (row.status === 'CANCELLED')
            return { state: 'ALREADY_CANCELLED' as const, serviceEndsAt: row.serviceEndsAt };
        if (row.status === 'CANCEL_SCHEDULED') {
            const [decision] = await tx
                .select({ changes: domainEvent.changes })
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.entityType, 'subscription'),
                        eq(domainEvent.entityId, row.id),
                        eq(domainEvent.eventType, 'subscription.provider_cancellation_decided')
                    )
                )
                .orderBy(desc(domainEvent.occurredAt))
                .limit(1);
            if (
                decision?.changes.some(
                    (change) => change.field === 'status' && change.old === 'PAUSED'
                ) &&
                row.serviceEndsAt
            )
                return { state: 'ALREADY_SCHEDULED' as const, serviceEndsAt: row.serviceEndsAt };
        }
        if (row.status !== 'PAUSED')
            return { state: 'REJECTED' as const, reason: 'NOT_PAUSED' as const };
        const [pause] = await tx
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, row.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (!pause) return { state: 'REJECTED' as const, reason: 'NO_OPEN_PAUSE' as const };
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
        await closeOpenPause({ tx, pauseId: pause.id, now });
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
            } satisfies Reading,
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
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: parsed.subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'owner', id: parsed.actor.id },
            correlationId: crypto.randomUUID()
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
    const providerResult = await cancelAtProvider({ reading, ports });
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
    try {
        await emitAddonCoverageRemoved({
            cancelled: committed.cancelled,
            coverageNotices: ports.coverageNotices
        });
    } catch (error) {
        logger.error(
            { subscriptionId: reading.subscriptionId, error },
            'S22 addon coverage notice failed'
        );
    }
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

async function cancelAtProvider(input: {
    readonly reading: Reading;
    readonly ports: CancelPausedSubscriptionPorts;
}): Promise<{
    readonly cancelCall: CancelActiveCall;
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}> {
    const { reading, ports } = input;
    if (!reading.cardPayer || !reading.authorizationId) return { cancelCall: 'NOT_APPLICABLE' };
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    try {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: reading.authorizationId
        });
        const fresh = assertFreshForAct({ read, act });
        if (fresh.snapshot.status === 'cancelled')
            await recordCancellationSeen({
                annotator,
                subscriptionId: reading.subscriptionId,
                seenAt: fresh.readAt
            });
        else
            await recordAuthorizationSeenAlive({
                annotator,
                subscriptionId: reading.subscriptionId,
                seenAt: fresh.readAt
            });
        let notice: BeforeCancelNoticeStatus | undefined;
        const observedNotice: BeforeCancelNotice = {
            async beforeCancel(args) {
                notice = await ports.beforeCancelNotice.beforeCancel(args);
                return notice;
            }
        };
        const shared = {
            subscriptionId: reading.subscriptionId,
            userId: reading.userId,
            authorizationId: reading.authorizationId,
            prior: { read, act }
        };
        const cancellationPorts = {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: observedNotice
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
        const cancelCall = CALL_BY_OUTCOME[outcome];
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
