import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import {
    CancellationReasonSchema,
    PermissionEnum,
    ServiceErrorCode,
    VerticalEnumSchema
} from '@repo/schemas';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types/index.js';
import { type BillingFactSink, emitBillingFact } from '../facts/billing-fact-sink.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import { resolveCancellationAuthority } from './cancellation-authorization.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import {
    cancelComplementsByS11Rule,
    cancelDecidedComplementsAtProvider,
    type DecidedComplementCancellationCall
} from './complement-s11-rule.js';
import { computeS11ServiceEnd, readS11ServiceEndFacts } from './s11-service-end.js';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from './subscription-billing-ports.js';

const logger = createLogger('cancel-active-subscription');
const permissionsSchema = z.array(z.nativeEnum(PermissionEnum));
const actorSchema = z.custom<Actor>((value) => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { readonly id?: unknown; readonly permissions?: unknown };
    return (
        z.uuid().safeParse(candidate.id).success &&
        permissionsSchema.safeParse(candidate.permissions).success
    );
});
const inputSchema = z.strictObject({
    actor: actorSchema,
    subscriptionId: z.string(),
    reason: CancellationReasonSchema.optional()
});
/** Stable machine-readable rejection reasons for the S11 act. */
export const CANCEL_ACTIVE_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'CANCELLATION_FORBIDDEN',
    'CANCELLATION_NOT_PRINCIPAL',
    'CANCELLATION_STATE_NOT_ALLOWED'
] as const;
/** One typed rejection reason returned by the S11 act. */
export type CancelActiveRejection = (typeof CANCEL_ACTIVE_REJECTIONS)[number];
const REJECTION_CODES: Readonly<Record<CancelActiveRejection, ServiceErrorCode>> = {
    SUBSCRIPTION_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    CANCELLATION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
    CANCELLATION_NOT_PRINCIPAL: ServiceErrorCode.ALREADY_EXISTS,
    CANCELLATION_STATE_NOT_ALLOWED: ServiceErrorCode.ALREADY_EXISTS
};
/**
 * Build an S11 rejection with its stable machine-readable reason.
 *
 * @param reason - Stable reason mapped to the service error code
 * @param message - Developer-facing description of the rejection
 * @returns A service error carrying `reason` in its fourth parameter
 */
export function cancelActiveRejection(
    reason: CancelActiveRejection,
    message: string
): ServiceError {
    return new ServiceError(REJECTION_CODES[reason], message, undefined, reason);
}
/** Result of the provider half of S11. */
export type CancelActiveCall =
    | 'SENT'
    | 'NOT_NEEDED'
    | 'NOTICE_PENDING'
    | 'FAILED'
    | 'NOT_APPLICABLE';
const CANCEL_CALL_BY_OUTCOME: Readonly<Record<CancelOurAuthorizationOutcome, CancelActiveCall>> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};
/** External ports required to complete the local and provider halves of S11. */
export interface CancelActiveSubscriptionPorts {
    /** Provider used to re-read and cancel the authorization after commit. */
    readonly provider: PaymentProvider;
    /** Clock used for the act instant and provider read instants. */
    readonly clock: Clock;
    /** Before-cancel notice port consumed by the shared provider cancellation helper. */
    readonly beforeCancelNotice: BeforeCancelNotice;
    /** Required best-effort coverage change notifier. */
    readonly coverageNotices: CoverageNotices;
    /** Required readers for the S11 complement selection policy. */
    readonly complements: ComplementPolicyPorts;
    /** Optional annotation of provider cancellation observations. */
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly billingFacts?: BillingFactSink;
}
/** Observable outcome of scheduling an active subscription's cancellation. */
export type CancelActiveSubscriptionResult =
    | {
          readonly outcome: 'SCHEDULED';
          readonly subscriptionId: string;
          readonly serviceEndsAt: Date;
          readonly basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
          readonly cancelCall: CancelActiveCall;
          readonly complements: {
              readonly decided: number;
              readonly calls: readonly DecidedComplementCancellationCall[];
          };
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
      }
    | {
          readonly outcome: 'ALREADY_SCHEDULED';
          readonly subscriptionId: string;
          readonly serviceEndsAt: Date;
          readonly complements: {
              readonly decided: 0;
              readonly calls: readonly [];
          };
      };
interface S11Reading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly serviceEndsAt: Date;
    readonly basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
    readonly cardPayer: boolean;
    readonly authorizationId: string | null;
    readonly cancellationReason: z.infer<typeof CancellationReasonSchema> | null;
    readonly actorKind: 'USER' | 'ADMIN';
}

/** The single guarded S11 write (G5): ACTIVE becomes CANCEL_SCHEDULED and receives its service end. */
async function writeS11Cancellation(input: {
    tx: DrizzleClient;
    subscriptionId: string;
    serviceEndsAt: Date;
    now: Date;
    reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCEL_SCHEDULED',
            serviceEndsAt: input.serviceEndsAt,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'ACTIVE')))
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/**
 * S11: schedule a principal's cancellation, retain paid service, and cancel its provider authorization after commit.
 *
 * @param input.actor - Owner or ACC_8 administrator requesting cancellation
 * @param input.subscriptionId - Subscription identifier (invalid UUIDs are hidden as not found)
 * @param ports - Provider, clock, notice and required coverage ports
 * @returns Scheduled service end and provider result, or an idempotent already-scheduled result
 * @throws ServiceError with a typed cancellation rejection reason
 */
export async function cancelActiveSubscription(
    input: {
        readonly actor: Actor;
        readonly subscriptionId: string;
        readonly reason?: z.infer<typeof CancellationReasonSchema>;
    },
    ports: CancelActiveSubscriptionPorts
): Promise<CancelActiveSubscriptionResult> {
    const parsed = inputSchema.parse(input);
    if (!z.uuid().safeParse(parsed.subscriptionId).success)
        throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [subscription] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, parsed.subscriptionId))
            .limit(1)
            .for('update');
        if (!subscription)
            throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        const authority = resolveCancellationAuthority({
            actor: parsed.actor,
            subjectUserId: subscription.userId
        });
        if (!authority.allowed) {
            if (authority.reason === 'FORBIDDEN')
                throw cancelActiveRejection('CANCELLATION_FORBIDDEN', 'Cancellation is forbidden');
            throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        if (subscription.class !== 'PRINCIPAL')
            throw cancelActiveRejection(
                'CANCELLATION_NOT_PRINCIPAL',
                'Only principal subscriptions can be cancelled'
            );
        if (subscription.status === 'CANCEL_SCHEDULED') {
            if (!subscription.serviceEndsAt)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Scheduled cancellation has no service end',
                    undefined,
                    'S11_SCHEDULED_SERVICE_END_MISSING'
                );
            return {
                already: true as const,
                subscriptionId: subscription.id,
                serviceEndsAt: subscription.serviceEndsAt
            };
        }
        if (subscription.status !== 'ACTIVE')
            throw cancelActiveRejection(
                'CANCELLATION_STATE_NOT_ALLOWED',
                'Subscription is not active'
            );
        const facts = await readS11ServiceEndFacts({ tx, subscription });
        const end = computeS11ServiceEnd({ now, ...facts });
        if (
            !(await writeS11Cancellation({
                tx,
                subscriptionId: subscription.id,
                serviceEndsAt: end.serviceEndsAt,
                now,
                reason: parsed.reason
            }))
        )
            throw cancelActiveRejection(
                'CANCELLATION_STATE_NOT_ALLOWED',
                'Subscription state changed'
            );
        const { decided } = await cancelComplementsByS11Rule(
            { tx, principalSubscriptionId: subscription.id, now },
            ports.complements
        );
        const [link] = await tx
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, subscription.id))
            .limit(1);
        const cardPayer = subscription.paymentMethod === 'CARD';
        if (cardPayer && link) {
            await recordProviderCancellationDecided({
                subscriptionId: subscription.id,
                transition: 'S11',
                decidedAt: now,
                actor: { type: authority.as === 'OWNER' ? 'owner' : 'admin', id: parsed.actor.id },
                correlationId: crypto.randomUUID(),
                changes: [{ field: 'status', old: 'ACTIVE', new: 'CANCEL_SCHEDULED' }],
                tx
            });
        } else if (cardPayer) {
            logger.error(
                { subscriptionId: subscription.id },
                'Active card subscription has no provider link'
            );
        }
        return {
            already: false as const,
            reading: {
                subscriptionId: subscription.id,
                userId: subscription.userId,
                vertical: subscription.vertical,
                serviceEndsAt: end.serviceEndsAt,
                basis: end.basis,
                cardPayer,
                authorizationId: link?.providerId ?? null,
                cancellationReason: parsed.reason ?? null,
                actorKind:
                    parsed.actor.id === subscription.userId ? ('USER' as const) : ('ADMIN' as const)
            } satisfies S11Reading,
            decided
        };
    });
    if (committed.already)
        return {
            outcome: 'ALREADY_SCHEDULED',
            subscriptionId: committed.subscriptionId,
            serviceEndsAt: committed.serviceEndsAt,
            complements: { decided: 0, calls: [] }
        };
    const reading = committed.reading;
    if (reading.userId && VerticalEnumSchema.safeParse(reading.vertical).success) {
        const validVertical = VerticalEnumSchema.parse(reading.vertical);
        emitBillingFact({
            sink: ports.billingFacts,
            fact: {
                kind: 'CANCEL_SCHEDULED',
                userId: reading.userId,
                vertical: validVertical,
                subscriptionId: reading.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: reading.actorKind,
                occurredAt: now,
                serviceEndsAt: reading.serviceEndsAt,
                basis: reading.basis,
                ...(reading.cancellationReason ? { reason: reading.cancellationReason } : {})
            }
        });
    }
    const vertical = VerticalEnumSchema.safeParse(reading.vertical);
    if (reading.userId && vertical.success) {
        try {
            await ports.coverageNotices.emitCoverageChanged({
                userId: reading.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: reading.subscriptionId, error },
                'Coverage change notice failed after S11 commit'
            );
        }
    } else
        logger.error(
            { subscriptionId: reading.subscriptionId, vertical: reading.vertical },
            'S11 row has no valid coverage subject'
        );
    const providerResult = await cancelAtProvider({ reading, ports });
    let complementResults: readonly DecidedComplementCancellationCall[] = [];
    try {
        const { results } = await cancelDecidedComplementsAtProvider(
            { decided: committed.decided },
            {
                provider: ports.provider,
                clock: ports.clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                cancellationSeen: ports.cancellationSeen
            }
        );
        complementResults = results;
    } catch (error) {
        logger.error(
            { subscriptionId: reading.subscriptionId, error },
            'S11 complement provider cancellation failed after commit'
        );
    }
    return {
        outcome: 'SCHEDULED',
        subscriptionId: reading.subscriptionId,
        serviceEndsAt: reading.serviceEndsAt,
        basis: reading.basis,
        complements: { decided: committed.decided.length, calls: complementResults },
        ...providerResult
    };
}

async function cancelAtProvider(input: {
    reading: S11Reading;
    ports: CancelActiveSubscriptionPorts;
}): Promise<{ cancelCall: CancelActiveCall; escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED' }> {
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
                kind: 'SCHEDULED_CANCELLATION',
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
            'S11 provider cancellation failed after commit'
        );
        return { cancelCall: 'FAILED' };
    }
}
