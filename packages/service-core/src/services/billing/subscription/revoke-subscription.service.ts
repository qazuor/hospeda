/**
 * S36 (TRANS:B:S36; AC:B5:20, AC:B5:21, AC:B5:22): a person registers the revocation of the
 * right of withdrawal with admin action 8, «cancelar una suscripción», reason revocation. It is
 * ONE operation (DEC-RF-001 part 1): the row goes to `CANCELLED` with its service ended now,
 * and an RF1 for the total of the last credited payment is born in the same transaction.
 * The transition is written BEFORE the provider call, and the call happens after the commit.
 * From S17's rule S36 takes the re-read, not the «if it fails, it does not happen»: its event
 * is a human act nobody re-evaluates, so like S22–S24 the row reaches `CANCELLED` whatever the
 * call does (contexto §4). S36 is one of the rows of exception 4 of the sweep (contexto §5):
 * the transaction records `subscription.provider_cancellation_decided`, and a call that was
 * not applied (notice not sent yet, provider failure) is retried by the sweep (B11, HOS-1603),
 * with the same notice first and the re-read after. A database lock is never held over HTTP.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, eq, getDb, isNull, providerLinks, subscriptionPauses, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import type { Actor } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import type { CoverageNotices } from '../payment/payment-ports';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import type { RefundSource } from '../refund/refund-source';
import {
    type RevocablePayment,
    revocationRejection as reject,
    resolveRevokedPayment
} from './revocation-payment';
import { requestRevocationRefund } from './revocation-refund';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from './subscription-billing-ports';

const logger = createLogger('revoke-subscription');

/** The administrative action S36 executes: one constant for the helper and the step (Coord-178). */
const ACTION = 'ACC_8' as const;

/** The states S36 leaves (TRANS:B:S36 «desde»; PAUSED with either reason). */
export const REVOCATION_ORIGINS = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED', 'PAUSED'] as const;

/** One state S36 leaves. */
export type RevocationOrigin = (typeof REVOCATION_ORIGINS)[number];

/** What the provider half of S36 ended in (I-6). */
export type RevocationCancelCall =
    | 'SENT'
    | 'NOT_NEEDED'
    | 'NOTICE_PENDING'
    | 'FAILED'
    | 'NOT_APPLICABLE';

/** Ports of S36. `coverageNotices` is mandatory: a new writer is not born with a silent default. */
export interface RevokeSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices: CoverageNotices;
    /** Defaults to the no-op; the route passes `providerLinkCancellationSeen`. */
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

/** The confirmation of action 8 with reason revocation: the three things it does (D-3). */
export interface SubscriptionRevocationPreview {
    readonly subscriptionId: string;
    readonly origin: RevocationOrigin;
    readonly payment: {
        readonly source: RefundSource['kind'];
        readonly id: string;
        readonly amount: number;
        readonly currency: string | null;
        readonly chargedAt: Date;
        readonly ownerSubscriptionId: string;
    };
    readonly windowEndsAt: Date;
    readonly effects: {
        /** False for a manual payer or a row without provider link: nothing to cancel. */
        readonly cancelsAuthorization: boolean;
        readonly endsServiceAt: 'NOW';
        readonly requestsRefund: true;
    };
}

/** Result of S36. */
export interface RevokeSubscriptionResult {
    readonly subscriptionId: string;
    readonly origin: RevocationOrigin;
    readonly serviceEndedAt: Date;
    readonly refundId: string;
    readonly refundAmount: number;
    readonly payment: { readonly source: RefundSource['kind']; readonly id: string };
    readonly cancelCall: RevocationCancelCall;
    /** Present when the before-cancel notice is not deliverable and the call went anyway. */
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}

/** Which origin closes a pause (h). Exhaustive by origin, never a ternary. */
const CLOSES_OPEN_PAUSE: Readonly<Record<RevocationOrigin, boolean>> = {
    ACTIVE: false,
    GRACE_PERIOD: false,
    CANCEL_SCHEDULED: false,
    PAUSED: true
};

/** What each outcome of the shared cancellation helper means for S36 (step l). */
const CANCEL_CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, RevocationCancelCall>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

const idSchema = z.uuid();

function isRevocationOrigin(status: string): status is RevocationOrigin {
    return (REVOCATION_ORIGINS as readonly string[]).includes(status);
}

/** Everything steps a–f decided, read inside one transaction. */
interface RevocationReading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly origin: RevocationOrigin;
    readonly authorizationId: string | null;
    readonly cardPayer: boolean;
    readonly payment: RevocablePayment;
    readonly windowEndsAt: Date;
}

/**
 * Steps a–f, shared by the preview and the act. With `lock` the subscription is read
 * `FOR UPDATE` (the act); without it (the read-only preview) it is a plain read. Any read
 * error throws: authorization fails closed, never on partial data.
 */
async function readRevocation(input: {
    readonly tx: DrizzleClient;
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly expectedPaymentId?: string;
    readonly now: Date;
    readonly lock: boolean;
}): Promise<RevocationReading> {
    const { tx } = input;
    // a. the row, locked by the act
    const query = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    const [subscription] = input.lock ? await query.for('update') : await query;
    if (!subscription) throw reject('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    // b. step 3 of the administrative action, with the subject read in THIS transaction
    const permitted = isAdministrativeActionPermitted({
        action: ACTION,
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: ACTION,
        actorId: input.actor.id,
        subjectId: subscription.userId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) throw reject('ADMINISTRATIVE_ACTION_FORBIDDEN', 'Forbidden');

    // c. only the contract (I-1), only from the four origins
    if (subscription.class !== 'PRINCIPAL')
        throw reject('REVOCATION_NOT_PRINCIPAL', 'Only a principal subscription is revoked');
    if (!isRevocationOrigin(subscription.status))
        throw reject(
            'REVOCATION_STATE_NOT_ALLOWED',
            `A ${subscription.status} subscription cannot be revoked`
        );

    // d–f. the last credited payment through `sucedida_por`, its window, the preview's payment
    const { payment, windowEndsAt } = await resolveRevokedPayment({
        tx,
        subscriptionId: subscription.id,
        now: input.now,
        expectedPaymentId: input.expectedPaymentId,
        lock: input.lock
    });

    const [link] = await tx
        .select({ providerId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscription.id))
        .limit(1);
    return {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        vertical: subscription.vertical,
        origin: subscription.status,
        authorizationId: link?.providerId ?? null,
        cardPayer: subscription.paymentMethod === 'CARD',
        payment,
        windowEndsAt
    };
}

/**
 * The single write of S36 on `subscription` (G5 `via: "notice"`): `<origin> → CANCELLED`,
 * service ended now, the grace clock off, guarded by the origin read under the lock. From
 * `PAUSED` it also closes the open pause with `actual_end_at` = now (I-8). The coverage
 * notice is emitted by `revokeSubscription` after the commit.
 *
 * @returns False when the row left its origin (the act then rejects as changed)
 */
async function writeRevocation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly origin: RevocationOrigin;
    readonly now: Date;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCELLED',
            serviceEndsAt: input.now,
            graceStartedAt: null,
            graceEndsAt: null,
            updatedAt: input.now
        })
        .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, input.origin))
        )
        .returning({ id: subscriptions.id });
    if (!row) return false;
    if (CLOSES_OPEN_PAUSE[input.origin]) {
        const closed = await input.tx
            .update(subscriptionPauses)
            .set({ actualEndAt: input.now })
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, input.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .returning({ id: subscriptionPauses.id });
        if (closed.length === 0)
            logger.warn(
                { subscriptionId: input.subscriptionId },
                'Revoked PAUSED subscription had no open pause to close'
            );
    }
    return true;
}

/**
 * The confirmation of S36 (D-3): steps a–f in a read-only transaction. Returns the payment
 * that would be returned, its amount, the end of the window and the three effects, writing
 * nothing; it rejects with the same reasons as the act.
 *
 * @param input.actor - The person registering the revocation
 * @param input.subscriptionId - The row to revoke
 * @param ports.clock - The clock
 * @returns The preview
 * @throws ServiceError with a `RevokeSubscriptionRejection` reason
 */
export async function previewSubscriptionRevocation(
    input: { readonly actor: Actor; readonly subscriptionId: string },
    ports: { readonly clock: Clock }
): Promise<SubscriptionRevocationPreview> {
    if (!idSchema.safeParse(input.subscriptionId).success)
        throw reject('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const reading = await getDb().transaction(
        (tx) =>
            readRevocation({
                tx,
                actor: input.actor,
                subscriptionId: input.subscriptionId,
                now: ports.clock.now(),
                lock: false
            }),
        { accessMode: 'read only' }
    );
    return {
        subscriptionId: reading.subscriptionId,
        origin: reading.origin,
        payment: {
            source: reading.payment.source.kind,
            id: reading.payment.source.id,
            amount: reading.payment.amount,
            currency: reading.payment.currency,
            chargedAt: reading.payment.chargedAt,
            ownerSubscriptionId: reading.payment.ownerSubscriptionId
        },
        windowEndsAt: reading.windowEndsAt,
        effects: {
            cancelsAuthorization: reading.cardPayer && reading.authorizationId !== null,
            endsServiceAt: 'NOW',
            requestsRefund: true
        }
    };
}

/** Step k: `REMOVED` after the commit; a failure is logged and undoes nothing (I-7). */
async function emitRemoved(input: {
    readonly reading: RevocationReading;
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const { reading } = input;
    const vertical = VerticalEnumSchema.safeParse(reading.vertical);
    if (!reading.userId || !vertical.success) {
        logger.error(
            { subscriptionId: reading.subscriptionId, vertical: reading.vertical },
            'Revoked subscription has no coverage subject to notify'
        );
        return;
    }
    try {
        await input.coverageNotices.emitCoverageChanged({
            userId: reading.userId,
            vertical: vertical.data,
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: reading.subscriptionId, error },
            'Coverage changed notice failed after revocation commit'
        );
    }
}

/**
 * Step l: the provider half, after the commit (I-6). Re-reads by id and annotates what it
 * saw, then reuses the shared helper of HOS-1603 (notice first, call, re-read after). It
 * never throws and never undoes the revocation: a call not applied is the sweep's to retry.
 */
async function cancelAtProvider(input: {
    readonly reading: RevocationReading;
    readonly ports: RevokeSubscriptionPorts;
}): Promise<{
    readonly cancelCall: RevocationCancelCall;
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}> {
    const { reading, ports } = input;
    const authorizationId = reading.authorizationId;
    if (!reading.cardPayer || authorizationId === null) return { cancelCall: 'NOT_APPLICABLE' };
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    const subscriptionId = reading.subscriptionId;
    try {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({ authorizationId });
        const fresh = assertFreshForAct({ read, act });
        if (fresh.snapshot.status === 'cancelled')
            await recordCancellationSeen({ annotator, subscriptionId, seenAt: fresh.readAt });
        else
            await recordAuthorizationSeenAlive({ annotator, subscriptionId, seenAt: fresh.readAt });

        // The helper only logs an undeliverable notice; S36 reports it, so it observes the answer.
        let notice: BeforeCancelNoticeStatus | undefined;
        const observedNotice: BeforeCancelNotice = {
            async beforeCancel(args) {
                notice = await ports.beforeCancelNotice.beforeCancel(args);
                return notice;
            }
        };
        const { outcome } = await cancelOurAuthorization(
            { subscriptionId, userId: reading.userId, authorizationId, prior: { read, act } },
            { provider: ports.provider, clock: ports.clock, beforeCancelNotice: observedNotice }
        );
        if (outcome === 'CONFIRMED')
            await recordCancellationSeen({ annotator, subscriptionId, seenAt: ports.clock.now() });
        const cancelCall = CANCEL_CALL_BY_OUTCOME[outcome];
        const escalated =
            cancelCall !== 'NOTICE_PENDING' &&
            (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
                ? notice
                : undefined;
        return { cancelCall, ...(escalated ? { escalated } : {}) };
    } catch (error) {
        logger.error(
            { subscriptionId, authorizationId, error },
            'Revocation could not cancel the authorization; the sweep retries it'
        );
        return { cancelCall: 'FAILED' };
    }
}

/**
 * S36: revokes a subscription in one act (AC:B5:20). In ONE transaction: the row `FOR UPDATE`,
 * the authorization of action 8 against the subject read there, the guards (principal, origin,
 * a credited payment through `sucedida_por`, the 10-day window, the payment the preview showed),
 * `CANCELLED` with the service ended now and the grace clock off, the open pause closed, the
 * coverage loss, the decision to cancel at the provider (card payers only) and the RF1. Then,
 * after the commit, the coverage notice and the provider call.
 *
 * @param input.actor - The person registering the revocation
 * @param input.subscriptionId - The row to revoke
 * @param input.expectedPaymentId - The payment the preview showed; a different one rejects
 * @param ports - Provider, clock, before-cancel notice, coverage notices, optional annotator
 * @returns What was written and what the provider half ended in
 * @throws ServiceError with a `RevokeSubscriptionRejection` reason; nothing is written
 */
export async function revokeSubscription(
    input: {
        readonly actor: Actor;
        readonly subscriptionId: string;
        readonly expectedPaymentId?: string;
    },
    ports: RevokeSubscriptionPorts
): Promise<RevokeSubscriptionResult> {
    // A non-uuid id names no row; a non-uuid expected payment never matches one (step f).
    if (!idSchema.safeParse(input.subscriptionId).success)
        throw reject('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const reading = await readRevocation({
            tx,
            actor: input.actor,
            subscriptionId: input.subscriptionId,
            expectedPaymentId: input.expectedPaymentId,
            now,
            lock: true
        });
        // g + h. CANCELLED before the RF1 (Coord-288), guarded by the origin read under the lock
        const written = await writeRevocation({
            tx,
            subscriptionId: reading.subscriptionId,
            origin: reading.origin,
            now
        });
        if (!written)
            throw reject('REVOCATION_STATE_CHANGED', 'The subscription left its origin state');
        // h2. coberturaPerdidaEn in the same transaction as the drop (AC:B4:4, Coord-285)
        if (reading.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: reading.userId,
                vertical: reading.vertical ?? '',
                lostAt: now,
                clock: ports.clock
            });
        // h3. the decision the sweep retries by (AC:B11:6, Coord-286); a manual payer has no call
        if (reading.cardPayer && reading.authorizationId !== null)
            await recordProviderCancellationDecided({
                subscriptionId: reading.subscriptionId,
                transition: 'S36',
                decidedAt: now,
                actor: { type: 'admin', id: input.actor.id },
                correlationId: crypto.randomUUID(),
                changes: [{ field: 'status', old: reading.origin, new: 'CANCELLED' }],
                tx
            });
        // i. RF1 for the total and, for a payment S19 retained, its flag off (AC:B5:23); any rejection rolls the whole act back
        const { refundId } = await requestRevocationRefund({
            tx,
            payment: reading.payment,
            now,
            clock: ports.clock
        });
        // S18 (AC:B5:34, HOS-1547) and the orphaning A5/S21 (AC:B5:24, HOS-1546) run here, AFTER the RF1 and the flag off, inside this transaction.
        return { reading, refundId };
    });

    const { reading, refundId } = committed;
    await emitRemoved({ reading, coverageNotices: ports.coverageNotices });
    const provider = await cancelAtProvider({ reading, ports });
    logger.info(
        {
            subscriptionId: reading.subscriptionId,
            origin: reading.origin,
            refundId,
            cancelCall: provider.cancelCall
        },
        'Subscription revoked (S36)'
    );
    return {
        subscriptionId: reading.subscriptionId,
        origin: reading.origin,
        serviceEndedAt: now,
        refundId,
        refundAmount: reading.payment.amount,
        payment: { source: reading.payment.source.kind, id: reading.payment.source.id },
        cancelCall: provider.cancelCall,
        ...(provider.escalated ? { escalated: provider.escalated } : {})
    };
}
