import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, desc, domainEvent, eq, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { CancellationReasonSchema, PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    type AddonProviderCancellationResult,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { CancelOurAuthorizationOutcome } from '../reconciliation/cancel-our-authorization.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { CancelActiveCall } from './cancel-active-subscription.service.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import type { DecidedComplementCancellationCall } from './complement-s11-rule.js';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type SuccessionCloser
} from './subscription-billing-ports.js';

const logger = createLogger('cancel-paused-subscription-support');

const actorSchema = z.custom<Actor>((value) => {
    if (typeof value !== 'object' || value === null) return false;
    const actor = value as { readonly id?: unknown; readonly permissions?: unknown };
    return (
        z.uuid().safeParse(actor.id).success &&
        z.array(z.nativeEnum(PermissionEnum)).safeParse(actor.permissions).success
    );
});

/** Strict runtime input boundary for S22. */
export const cancelPausedInputSchema = z.strictObject({
    actor: actorSchema,
    subscriptionId: z.string(),
    reason: CancellationReasonSchema.optional()
});

/** Provider outcome mapping shared by S22's two branches. */
export const CANCEL_PAUSED_CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, CancelActiveCall>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/** Provider half of S22, including a notice delivery escalation when present. */
export type CancelPausedProviderResult = {
    readonly cancelCall: CancelActiveCall;
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
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

/** Stable provider cancellation target after S22 commits. */
export interface CancelPausedReading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly cardPayer: boolean;
    readonly authorizationId: string | null;
    readonly kind: 'DIRECT_CANCELLATION' | 'SCHEDULED_CANCELLATION';
}

/** S22's stable outcomes, including typed precondition failures. */
export type CancelPausedSubscriptionResult =
    | { readonly outcome: 'REJECTED'; readonly reason: 'NOT_PAUSED' | 'NO_OPEN_PAUSE' }
    | { readonly outcome: 'LOST_RACE' }
    | { readonly outcome: 'ALREADY_CANCELLED'; readonly serviceEndsAt: Date | null }
    | { readonly outcome: 'ALREADY_SCHEDULED'; readonly serviceEndsAt: Date }
    | {
          readonly outcome: 'CANCELLED';
          readonly serviceEndsAt: Date;
          readonly cancelCall: CancelActiveCall;
          readonly successionClosed: boolean;
          readonly orphanedAddonIds: readonly string[];
          readonly addonCancelCalls: readonly AddonProviderCancellationResult[];
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
      }
    | {
          readonly outcome: 'SCHEDULED';
          readonly serviceEndsAt: Date;
          readonly basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
          readonly cancelCall: CancelActiveCall;
          readonly complements: {
              readonly decided: number;
              readonly calls: readonly DecidedComplementCancellationCall[];
          };
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
      };

/** S22's guarded PAUSED to CANCELLED write, registered as a turns-off writer by G5. */
export async function writePausedCancellation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCELLED',
            serviceEndsAt: input.now,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'PAUSED')))
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/** S22's guarded PAUSED to CANCEL_SCHEDULED write, registered as neutral by G5. */
export async function writePausedScheduledCancellation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly serviceEndsAt: Date;
    readonly reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCEL_SCHEDULED',
            serviceEndsAt: input.serviceEndsAt,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'PAUSED')))
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/** Closes exactly the pause whose open id was read under the principal lock. */
export async function closeOpenPause(input: {
    readonly tx: DrizzleClient;
    readonly pauseId: string;
    readonly now: Date;
}): Promise<void> {
    const [row] = await input.tx
        .update(subscriptionPauses)
        .set({ actualEndAt: input.now })
        .where(
            and(eq(subscriptionPauses.id, input.pauseId), isNull(subscriptionPauses.actualEndAt))
        )
        .returning({ id: subscriptionPauses.id });
    if (!row) throw new Error('S22 open pause changed under principal lock');
}

/** Finds a committed S22 outcome without writing another decision. */
export async function readPausedCancellationIdempotency(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly status: string;
    readonly serviceEndsAt: Date | null;
}): Promise<
    | { readonly state: 'ALREADY_CANCELLED'; readonly serviceEndsAt: Date | null }
    | { readonly state: 'ALREADY_SCHEDULED'; readonly serviceEndsAt: Date }
    | null
> {
    if (input.status === 'CANCELLED')
        return { state: 'ALREADY_CANCELLED', serviceEndsAt: input.serviceEndsAt };
    if (input.status !== 'CANCEL_SCHEDULED') return null;
    const [decision] = await input.tx
        .select({ changes: domainEvent.changes })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, input.subscriptionId),
                eq(domainEvent.eventType, 'subscription.provider_cancellation_decided')
            )
        )
        .orderBy(desc(domainEvent.occurredAt))
        .limit(1);
    if (
        decision?.changes.some((change) => change.field === 'status' && change.old === 'PAUSED') &&
        input.serviceEndsAt
    )
        return { state: 'ALREADY_SCHEDULED', serviceEndsAt: input.serviceEndsAt };
    return null;
}

/** Reads the open pause id under its principal's row lock. */
export async function readOpenPauseId(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<string | null> {
    const [pause] = await input.tx
        .select({ id: subscriptionPauses.id })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, input.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    return pause?.id ?? null;
}

/** Opens rule 1's reconciliation mark for a lost S22 write race. */
export async function markPausedCancellationLostRace(input: {
    readonly subscriptionId: string;
    readonly actorId: string;
}): Promise<void> {
    await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: 'TRANSICION_NO_DECLARADA',
        actor: { type: 'owner', id: input.actorId },
        correlationId: crypto.randomUUID()
    });
}

/** Emits addon coverage removals after commit without cancelling authorizations. */
export async function emitPausedAddonCoverageRemoved(input: {
    readonly subscriptionId: string;
    readonly cancelled: Parameters<typeof emitAddonCoverageRemoved>[0]['cancelled'];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    try {
        await emitAddonCoverageRemoved(input);
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'S22 addon coverage notice failed'
        );
    }
}

/** Takes a fresh S17-style decision read and annotates the observed provider state. */
export async function readPausedAuthorizationForAct(input: {
    readonly reading: CancelPausedReading;
    readonly ports: CancelPausedSubscriptionPorts;
}): Promise<{
    readonly read: Awaited<ReturnType<PaymentProvider['readAuthorization']>>;
    readonly act: { readonly kind: 'decision'; readonly startedAt: Date };
}> {
    const { reading, ports } = input;
    if (!reading.authorizationId) throw new Error('S22 authorization id missing');
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: reading.authorizationId
    });
    const fresh = assertFreshForAct({ read, act });
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
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
    return { read, act };
}

/** Captures the first before-cancel notice result for S22's provider outcome. */
export function observePausedBeforeCancelNotice(port: BeforeCancelNotice): {
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly status: () => BeforeCancelNoticeStatus | undefined;
} {
    let notice: BeforeCancelNoticeStatus | undefined;
    return {
        beforeCancelNotice: {
            async beforeCancel(args) {
                notice = await port.beforeCancel(args);
                return notice;
            }
        },
        status: () => notice
    };
}
