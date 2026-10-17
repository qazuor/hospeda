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
import { and, eq, getDb, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import {
    type AddonProviderCancellationResult,
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved,
    runOrphanhood
} from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import type { CoverageNotices } from '../payment/payment-ports';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import type { RefundSource } from '../refund/refund-source';
import { requestOneTimeAddonRefunds } from './revocation-addon-refunds';
import { revocationRejection as reject } from './revocation-payment';
import {
    type RevocationOrigin,
    type RevocationReading,
    readRevocation
} from './revocation-reading';
import { requestRevocationRefund } from './revocation-refund';
import { type SuccessionCloser, unimplementedSuccessionCloser } from './subscription-billing-ports';
import { closeSuccessionIfPredecessor } from './succession-end';

export {
    previewSubscriptionRevocation,
    REVOCATION_ORIGINS,
    type RevocationOrigin,
    type SubscriptionRevocationPreview
} from './revocation-reading';

import { z } from 'zod';
import type { Actor } from '../../../types';
import type { BeforeCancelNotice, BeforeCancelNoticeStatus } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from './subscription-billing-ports';

const logger = createLogger('revoke-subscription');
const idSchema = z.uuid();

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
    readonly orphanhood: AddonOrphanhoodPorts;
    /** S18's interface (B8b); defaults to `unimplementedSuccessionCloser`, which throws. */
    readonly successionCloser?: SuccessionCloser;
    /** Defaults to the no-op; the route passes `providerLinkCancellationSeen`. */
    readonly cancellationSeen?: CancellationSeenAnnotator;
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
    readonly orphanedAddonIds: readonly string[];
    readonly oneTimeAddonRefunds: readonly {
        readonly instanceId: string;
        readonly refundId: string;
    }[];
    readonly addonCancelCalls: readonly AddonProviderCancellationResult[];
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
        const target = { subscriptionId, userId: reading.userId, authorizationId };
        const { outcome } = await cancelOurAuthorization(
            { ...target, kind: 'REVOCATION', prior: { read, act } },
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
 * coverage loss, the decision to cancel at the provider (card payers only), the RF1, S18 when
 * this is a live succession predecessor, orphanhood and one-time-addon refunds. Then,
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
        await closeSuccessionIfPredecessor(
            { predecessorSubscriptionId: reading.subscriptionId, tx },
            { successionCloser: ports.successionCloser ?? unimplementedSuccessionCloser }
        );
        const { cancelled } = await runOrphanhood(
            { tx, subscriptionId: reading.subscriptionId, now, s21Cause: 'REVOCATION' },
            ports.orphanhood
        );
        const oneTime = await requestOneTimeAddonRefunds({
            tx,
            cancelled,
            now,
            clock: ports.clock
        });
        return { reading, refundId, cancelled, oneTime };
    });

    const { reading, refundId, cancelled, oneTime } = committed;
    await emitRemoved({ reading, coverageNotices: ports.coverageNotices });
    const provider = await cancelAtProvider({ reading, ports });
    await emitAddonCoverageRemoved({ cancelled, coverageNotices: ports.coverageNotices });
    const addonCancelCalls = (
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
    logger.info(
        {
            subscriptionId: reading.subscriptionId,
            origin: reading.origin,
            refundId,
            cancelCall: provider.cancelCall,
            orphanedAddonCount: cancelled.length,
            oneTimeAddonRefundCount: oneTime.refunds.length,
            addonCancelCallCount: addonCancelCalls.length
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
        orphanedAddonIds: cancelled.map(({ instanceId }) => instanceId),
        oneTimeAddonRefunds: oneTime.refunds.map(({ instanceId, refundId }) => ({
            instanceId,
            refundId
        })),
        addonCancelCalls,
        ...(provider.escalated ? { escalated: provider.escalated } : {})
    };
}
