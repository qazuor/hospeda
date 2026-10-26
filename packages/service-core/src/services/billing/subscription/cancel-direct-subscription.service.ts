import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { CancellationReasonSchema, PermissionEnum, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    type AddonProviderCancellationResult,
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved,
    runOrphanhood
} from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import { type BillingFactSink, emitBillingFact } from '../facts/billing-fact-sink.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import {
    type CancelActiveCall,
    cancelActiveRejection
} from './cancel-active-subscription.service.js';
import { resolveCancellationAuthority } from './cancellation-authorization.js';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type SuccessionCloser,
    unimplementedSuccessionCloser
} from './subscription-billing-ports.js';
import { closeSuccessionIfPredecessor } from './succession-end.js';

const logger = createLogger('cancel-direct-subscription');
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

/** Origins handled by the direct subscription cancellation act. */
export const DIRECT_CANCELLATION_ORIGINS = ['SUSPENDED', 'GRACE_PERIOD'] as const;
/** A direct cancellation origin. */
export type DirectCancellationOrigin = (typeof DIRECT_CANCELLATION_ORIGINS)[number];
/** Transition selected for each direct cancellation origin. */
export const DIRECT_TRANSITION_BY_ORIGIN: Readonly<
    Record<DirectCancellationOrigin, 'S23' | 'S24'>
> = {
    SUSPENDED: 'S23',
    GRACE_PERIOD: 'S24'
};
/** Ports required by S23/S24. */
export interface CancelDirectSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly billingFacts?: BillingFactSink;
}
/** Result of S23/S24. */
export type CancelDirectSubscriptionResult =
    | {
          readonly outcome: 'CANCELLED';
          readonly subscriptionId: string;
          readonly origin: DirectCancellationOrigin;
          readonly transition: 'S23' | 'S24';
          readonly serviceEndedAt: Date;
          readonly cancelCall: CancelActiveCall;
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
          readonly successionClosed: boolean;
          readonly orphanedAddonIds: readonly string[];
          readonly addonCancelCalls: readonly AddonProviderCancellationResult[];
      }
    | {
          readonly outcome: 'ALREADY_CANCELLED';
          readonly subscriptionId: string;
          readonly serviceEndedAt: Date | null;
      };

interface Reading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly origin: DirectCancellationOrigin;
    readonly cardPayer: boolean;
    readonly authorizationId: string | null;
    readonly cancellationReason: z.infer<typeof CancellationReasonSchema> | null;
    readonly actorKind: 'USER' | 'ADMIN';
}
const CANCEL_CALL_BY_OUTCOME: Readonly<Record<CancelOurAuthorizationOutcome, CancelActiveCall>> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};
const DECIDE_BY_ORIGIN: Readonly<
    Record<
        DirectCancellationOrigin,
        (args: {
            readonly tx: DrizzleClient;
            readonly subscriptionId: string;
            readonly now: Date;
            readonly actor: { readonly type: 'owner' | 'admin'; readonly id: string };
        }) => Promise<unknown>
    >
> = {
    SUSPENDED: (args) =>
        recordProviderCancellationDecided({
            subscriptionId: args.subscriptionId,
            transition: 'S23',
            decidedAt: args.now,
            actor: args.actor,
            correlationId: crypto.randomUUID(),
            changes: [{ field: 'status', old: 'SUSPENDED', new: 'CANCELLED' }],
            tx: args.tx
        }),
    GRACE_PERIOD: (args) =>
        recordProviderCancellationDecided({
            subscriptionId: args.subscriptionId,
            transition: 'S24',
            decidedAt: args.now,
            actor: args.actor,
            correlationId: crypto.randomUUID(),
            changes: [{ field: 'status', old: 'GRACE_PERIOD', new: 'CANCELLED' }],
            tx: args.tx
        })
};

/** The only G5 writer for S23/S24. */
async function writeDirectCancellation(input: {
    tx: DrizzleClient;
    subscriptionId: string;
    origin: DirectCancellationOrigin;
    now: Date;
    reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCELLED',
            serviceEndsAt: input.now,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, input.origin))
        )
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/**
 * Executes S23 from SUSPENDED and S24 from GRACE_PERIOD. The service ends today; grace anchors
 * are retained. Within one transaction it locks and authorizes, writes the terminal state,
 * decides the provider cancellation, closes S18, runs A5 and records coverage loss; after commit
 * it emits REMOVED, cancels the provider authorization, then processes addon notices/cancellations.
 *
 * @param input - Actor and subscription id
 * @param ports - Provider, notice, coverage, orphanhood and clock ports
 * @returns Direct cancellation or an idempotent already-cancelled result
 * @throws ServiceError with the S11 cancellation rejection reasons
 */
export async function cancelDirectSubscription(
    input: {
        readonly actor: Actor;
        readonly subscriptionId: string;
        readonly reason?: z.infer<typeof CancellationReasonSchema>;
    },
    ports: CancelDirectSubscriptionPorts
): Promise<CancelDirectSubscriptionResult> {
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
            return {
                already: true as const,
                subscriptionId: row.id,
                serviceEndedAt: row.serviceEndsAt
            };
        if (row.status !== 'SUSPENDED' && row.status !== 'GRACE_PERIOD')
            throw cancelActiveRejection(
                'CANCELLATION_STATE_NOT_ALLOWED',
                'Subscription state is not eligible for direct cancellation'
            );
        const origin = row.status;
        if (
            !(await writeDirectCancellation({
                tx,
                subscriptionId: row.id,
                origin,
                now,
                reason: parsed.reason
            }))
        )
            throw cancelActiveRejection(
                'CANCELLATION_STATE_NOT_ALLOWED',
                'Subscription state changed'
            );
        const [link] = await tx
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.id))
            .limit(1);
        const cardPayer = row.paymentMethod === 'CARD';
        if (cardPayer && link)
            await DECIDE_BY_ORIGIN[origin]({
                tx,
                subscriptionId: row.id,
                now,
                actor: { type: authority.as === 'OWNER' ? 'owner' : 'admin', id: parsed.actor.id }
            });
        else if (cardPayer)
            logger.error(
                { subscriptionId: row.id },
                'Directly cancelled card subscription has no provider link'
            );
        const succession = await closeSuccessionIfPredecessor(
            { predecessorSubscriptionId: row.id, tx },
            { successionCloser: ports.successionCloser ?? unimplementedSuccessionCloser }
        );
        const { cancelled } = await runOrphanhood(
            { tx, subscriptionId: row.id, now },
            ports.orphanhood
        );
        if (row.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: row.userId,
                vertical: row.vertical ?? '',
                lostAt: now,
                clock: ports.clock
            });
        return {
            already: false as const,
            reading: {
                subscriptionId: row.id,
                userId: row.userId,
                vertical: row.vertical,
                origin,
                cardPayer,
                authorizationId: link?.providerId ?? null,
                cancellationReason: parsed.reason ?? null,
                actorKind: parsed.actor.id === row.userId ? ('USER' as const) : ('ADMIN' as const)
            } satisfies Reading,
            cancelled,
            successionClosed: succession.called
        };
    });
    if (committed.already)
        return {
            outcome: 'ALREADY_CANCELLED',
            subscriptionId: committed.subscriptionId,
            serviceEndedAt: committed.serviceEndedAt
        };
    const { reading, cancelled } = committed;
    const vertical = VerticalEnumSchema.safeParse(reading.vertical);
    if (reading.userId && vertical.success)
        emitBillingFact({
            sink: ports.billingFacts,
            fact: {
                kind: 'SUBSCRIPTION_CANCELLED',
                userId: reading.userId,
                vertical: vertical.data,
                subscriptionId: reading.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: reading.actorKind,
                occurredAt: now,
                cancelledBy: reading.actorKind,
                path:
                    reading.origin === 'GRACE_PERIOD'
                        ? 'DIRECT_FROM_GRACE'
                        : 'DIRECT_FROM_SUSPENDED',
                wasScheduled: false,
                ...(reading.cancellationReason ? { reason: reading.cancellationReason } : {})
            }
        });
    if (reading.userId && vertical.success)
        try {
            await ports.coverageNotices.emitCoverageChanged({
                userId: reading.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: reading.subscriptionId, error },
                'Direct cancellation coverage notice failed'
            );
        }
    else
        logger.error(
            { subscriptionId: reading.subscriptionId, vertical: reading.vertical },
            'Direct cancellation has no valid coverage subject'
        );
    const provider = await cancelAtProvider({ reading, ports });
    try {
        await emitAddonCoverageRemoved({ cancelled, coverageNotices: ports.coverageNotices });
    } catch (error) {
        logger.error(
            { subscriptionId: reading.subscriptionId, error },
            'Direct cancellation addon coverage notice failed'
        );
    }
    let addonCancelCalls: readonly AddonProviderCancellationResult[] = [];
    try {
        addonCancelCalls = (
            await cancelAddonComplementsAtProvider(
                { cancelled },
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
            'Direct cancellation addon provider cancellations failed'
        );
    }
    return {
        outcome: 'CANCELLED',
        subscriptionId: reading.subscriptionId,
        origin: reading.origin,
        transition: DIRECT_TRANSITION_BY_ORIGIN[reading.origin],
        serviceEndedAt: now,
        cancelCall: provider.cancelCall,
        successionClosed: committed.successionClosed,
        orphanedAddonIds: cancelled.map(({ instanceId }) => instanceId),
        addonCancelCalls,
        ...(provider.escalated ? { escalated: provider.escalated } : {})
    };
}

async function cancelAtProvider(input: {
    reading: Reading;
    ports: CancelDirectSubscriptionPorts;
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
        const { outcome } = await cancelOurAuthorization(
            {
                subscriptionId: reading.subscriptionId,
                userId: reading.userId,
                authorizationId: reading.authorizationId,
                kind: 'DIRECT_CANCELLATION',
                prior: { read, act }
            },
            { provider: ports.provider, clock: ports.clock, beforeCancelNotice: observedNotice }
        );
        if (outcome === 'CONFIRMED')
            await recordCancellationSeen({
                annotator,
                subscriptionId: reading.subscriptionId,
                seenAt: ports.clock.now()
            });
        const cancelCall = CANCEL_CALL_BY_OUTCOME[outcome];
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
            'Direct cancellation could not cancel authorization; sweep retries'
        );
        return { cancelCall: 'FAILED' };
    }
}
