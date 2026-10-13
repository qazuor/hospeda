import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { readArrearsSuspensionNoticeContent } from './arrears-suspension-notice';
import type { BeforeCancelNotice } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    noRetainedPeriodPayment,
    type RetainedPeriodPayment,
    recordCancellationSeen
} from './subscription-billing-ports';

const logger = createLogger('suspend-for-arrears');

/**
 * The events that move a row to `SUSPENDED` by S6. Only the first one exists
 * today: the grace clock ran out (AC:B7:7). B7.3 and B7.1b add their events here.
 */
export const SUSPEND_FOR_ARREARS_EVENTS = ['GRACE_EXPIRED'] as const;

/** One of the S6 events this service implements. */
export type SuspendForArrearsEvent = (typeof SUSPEND_FOR_ARREARS_EVENTS)[number];

/** The state each S6 event leaves; the `UPDATE` is guarded by it. */
const ORIGIN_STATUS_BY_EVENT: Readonly<Record<SuspendForArrearsEvent, 'GRACE_PERIOD'>> = {
    GRACE_EXPIRED: 'GRACE_PERIOD'
};

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    event: z.enum(SUSPEND_FOR_ARREARS_EVENTS),
    occurrenceId: z.string().min(1)
});

/** Input of S6: the row, the event that fired, and that event's occurrence (notice dedup key). */
export interface SuspendForArrearsInput {
    readonly subscriptionId: string;
    readonly event: SuspendForArrearsEvent;
    /** The occurrence of the fact that decided the cancellation (precision 3 of the before-cancel rule). */
    readonly occurrenceId: string;
}

/** Outcomes of S6. `DEFERRED` writes nothing: the row stays where it was, with its clock. */
export type SuspendForArrearsResult =
    | {
          readonly outcome: 'SUSPENDED';
          readonly subscriptionId: string;
          readonly cancelCall: 'SENT' | 'NOT_NEEDED';
          /** Present when the before-cancel notice is not deliverable and was escalated (D-8). */
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
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
              | 'NOT_IN_GRACE'
              | 'NOT_CARD_PRINCIPAL'
              | 'RETAINED_PAYMENT'
              | 'LOST_RACE';
      };

/** Ports of S6. The optional ones default until B4 / B4.2 / B7.4b wire them. */
export interface SuspendForArrearsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly retainedPeriodPayment?: RetainedPeriodPayment;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly coverageNotices?: CoverageNotices;
}

/**
 * The single write of S6 plus its post-commit coverage notice (G5 `via: "notice"`):
 * `<origin> → SUSPENDED`, then `REMOVED` is emitted once the transaction committed.
 * A notice failure is logged and undoes nothing. The grace clock is KEPT: on a
 * `SUSPENDED` row `grace_started_at` is the anchor of the unpaid period that S7
 * binds condition 4 to (HOS-1560, H1); S7 empties it when the row leaves.
 *
 * @param input.subscriptionId - The row being suspended
 * @param input.origin - The status the event leaves (the `UPDATE` guard)
 * @param input.now - The write instant
 * @param input.coverageNotices - The coverage listener (B4.2 wires it)
 * @returns True when this call moved the row; false when it lost the race
 */
export async function writeArrearsSuspension(input: {
    readonly subscriptionId: string;
    readonly origin: 'GRACE_PERIOD';
    readonly now: Date;
    readonly coverageNotices: CoverageNotices;
}): Promise<boolean> {
    const updated = await getDb().transaction(async (tx) => {
        const [row] = await tx
            .update(subscriptions)
            .set({
                status: 'SUSPENDED',
                updatedAt: input.now
            })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, input.origin)
                )
            )
            .returning({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            });
        return row ?? null;
    });
    if (!updated) return false;

    const vertical = VerticalEnumSchema.safeParse(updated.vertical);
    if (updated.userId && vertical.success) {
        try {
            await input.coverageNotices.emitCoverageChanged({
                userId: updated.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: updated.id, error },
                'Coverage changed notice failed after suspension commit'
            );
        }
    } else {
        logger.error(
            { subscriptionId: updated.id, vertical: updated.vertical },
            'Suspended subscription has no coverage subject to notify'
        );
    }
    return true;
}

/**
 * S6 (AC:B7:7), first event: the grace clock ran out and the `B/09` §4 read did
 * not show a credited charge of the period (the caller decided that). Moves a
 * `GRACE_PERIOD` card principal to `SUSPENDED` and cancels its authorization in
 * the same act, with S17's re-read rule (DEC-SUB-019):
 *
 * 1. no S19-retained payment of the period (I-7);
 * 2. read what the suspension notice says (AC:B7:30), then re-read the
 *    authorization by id; already `cancelled` → no cancel call, and the same
 *    notice is enqueued without blocking (H2);
 * 3. otherwise our before-cancel notice first (DEC-MAIL-001): `NOT_YET_SENT`
 *    defers without calling or writing; `NO_RECIPIENT`/`DELIVERY_EXHAUSTED`
 *    cancel anyway and escalate (D-8);
 * 4. `provider.cancel`; if it throws, nothing is written and the row stays in
 *    grace with its clock;
 * 5. a best-effort confirmation re-read;
 * 6. the `UPDATE` guarded by the origin status, then `REMOVED` after commit.
 *
 * The succession-in-progress guard (AC:B7:11) belongs to B7.3 and is not here.
 *
 * @param input - The row, the event and its occurrence
 * @param ports - Provider, clock, notice and the optional ports
 * @returns The S6 outcome
 */
export async function suspendForArrears(
    input: SuspendForArrearsInput,
    ports: SuspendForArrearsPorts
): Promise<SuspendForArrearsResult> {
    const value = inputSchema.parse(input);
    const origin = ORIGIN_STATUS_BY_EVENT[value.event];

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    if (subscription.status !== origin)
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' };
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' };

    const retained = ports.retainedPeriodPayment ?? noRetainedPeriodPayment;
    if (await retained.hasRetainedPeriodPayment({ subscriptionId: subscription.id }))
        return { outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' };

    // What the suspension notice says (AC:B7:30), read while the row is still in
    // its origin status. It decides nothing; if it throws, S6 throws and the
    // sweep retries, so no half notice is ever sent.
    const content = await readArrearsSuspensionNoticeContent({
        subscription,
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
        // H2: the same suspension notice goes out, but there is no cancellation
        // to precede (DEC-MAIL-001), so its outcome never blocks the write.
        try {
            const notice = await ports.beforeCancelNotice.beforeCancel({
                subscriptionId: subscription.id,
                userId: subscription.userId ?? '',
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: value.occurrenceId,
                content
            });
            if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
                logger.warn(
                    { subscriptionId: subscription.id, notice, event: value.event },
                    'Arrears suspension notice is not deliverable; suspending anyway'
                );
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, event: value.event, error },
                'Arrears suspension notice could not be enqueued; suspending anyway'
            );
        }
    } else {
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: subscription.id,
            userId: subscription.userId ?? '',
            kind: 'ARREARS_SUSPENSION',
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
                { subscriptionId: subscription.id, notice, event: value.event },
                'Arrears suspension notice is not deliverable; cancelling anyway'
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
                'Arrears suspension could not cancel the authorization; S6 deferred'
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
        } catch (error) {
            logger.error(
                {
                    subscriptionId: subscription.id,
                    authorizationId: providerLink.providerId,
                    error
                },
                'Could not confirm the arrears suspension cancellation'
            );
        }
    }

    const suspended = await writeArrearsSuspension({
        subscriptionId: subscription.id,
        origin,
        now: ports.clock.now(),
        coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
    });
    if (!suspended) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
    logger.info(
        { subscriptionId: subscription.id, event: value.event, cancelCall },
        'Subscription suspended for arrears'
    );
    return {
        outcome: 'SUSPENDED',
        subscriptionId: subscription.id,
        cancelCall,
        ...(escalated ? { escalated } : {})
    };
}
