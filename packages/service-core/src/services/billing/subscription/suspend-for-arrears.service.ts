import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { emitBillingFact } from '../facts/billing-fact-sink';
import { buildSuspendedFact } from '../facts/suspended-fact.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { readArrearsSuspensionNoticeContent } from './arrears-suspension-notice';
import { writeArrearsSuspension } from './arrears-suspension-write';
import { type PauseComplementsSummary, pauseComplementsS32 } from './complement-pause-s32.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { isLiveSuccessionPredecessor } from './late-payment-conditions.js';
import type { BeforeCancelNotice } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    type RetainedPeriodPayment,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from './subscription-billing-ports';
import { openSuccessionRetentions } from './succession-retained-payment';

const logger = createLogger('suspend-for-arrears');

/**
 * The events that move a row to `SUSPENDED` by S6 (TRANS:B:S6, corpus names in
 * `transition-tables.json`):
 * - `GRACE_EXPIRED` — first event, the grace clock ran out (AC:B7:7);
 * - `PROVIDER_PAUSE_OBSERVED` — second event (`provider_pause_observed`), for now
 *   a card principal in `ACTIVE` or `GRACE_PERIOD` whose preapproval was read
 *   `paused` (AC:B7:9; B7.3; from `ACTIVE` the occurrence is stable per next charge;
 *   that second event writes the unpaid-period anchor for S7, HOS-1690);
 * - `SUCCESSOR_PROVIDER_CANCELLED` — fifth event (`successor_provider_cancelled`),
 *   that successor's preapproval read `cancelled` by the sweep or the receiver
 *   (AC:B7:4, DEC-SUB-022).
 */
export const SUSPEND_FOR_ARREARS_EVENTS = [
    'GRACE_EXPIRED',
    'PROVIDER_PAUSE_OBSERVED',
    'SUCCESSOR_PROVIDER_CANCELLED'
] as const;

/** One of the S6 events this service implements. */
export type SuspendForArrearsEvent = (typeof SUSPEND_FOR_ARREARS_EVENTS)[number];

/** States each S6 event may leave; the `UPDATE` is guarded by the state read. */
const ORIGIN_STATUSES_BY_EVENT: Readonly<
    Record<SuspendForArrearsEvent, readonly ('ACTIVE' | 'GRACE_PERIOD')[]>
> = {
    GRACE_EXPIRED: ['GRACE_PERIOD'],
    PROVIDER_PAUSE_OBSERVED: ['ACTIVE', 'GRACE_PERIOD'],
    SUCCESSOR_PROVIDER_CANCELLED: ['GRACE_PERIOD']
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
          /** S32 outcomes when this composition root supplied complement policy ports. */
          readonly complements?: PauseComplementsSummary;
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
              | 'SUCCESSION_IN_PROGRESS'
              | 'NOT_CARD_PRINCIPAL'
              | 'RETAINED_PAYMENT'
              | 'LOST_RACE';
      };

/** Ports of S6. The optional ones default until B4 / B4.2 wire them. */
export interface SuspendForArrearsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    /** Defaults to the real read of an open S19 retention (HOS-1561 H5). */
    readonly retainedPeriodPayment?: RetainedPeriodPayment;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    /** Optional S32 policy readers; composition roots wire these in the API corrida. */
    readonly complements?: ComplementPolicyPorts;
}

export { type ArrearsSuspensionWrite, writeArrearsSuspension } from './arrears-suspension-write';

/**
 * S6 (AC:B7:7, AC:B7:4, AC:B7:9). First event: the grace clock ran out and the `B/09` §4
 * read did not show a credited charge of the period (the caller decided that).
 * Second and fifth events (AC:B7:4): the successor of a paying predecessor in
 * `ACTIVE` or `GRACE_PERIOD` card principal whose preapproval was read `paused`,
 * or a successor in grace whose preapproval was read `cancelled` (the caller
 * decided from a read by id). Each event admits only its declared origin state.
 * Every event moves a card principal to `SUSPENDED` and cancels its authorization in
 * the same act, with S17's re-read rule (DEC-SUB-019):
 *
 * 1. no S19-retained payment of the period (I-7); by default the real read of an
 *    open retention, asked again inside the write (HOS-1561 H5);
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
 * After the S19 retained-payment guard, AC:B7:11 skips the first, second and
 * fifth events while a live successor points at this predecessor. The third
 * event (chargeback, Phase 2) will be exempt from that guard.
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
    const origins = ORIGIN_STATUSES_BY_EVENT[value.event];

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    if (!origins.includes(subscription.status as 'ACTIVE' | 'GRACE_PERIOD'))
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' };
    const origin = subscription.status as 'ACTIVE' | 'GRACE_PERIOD';
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' };

    const retained = ports.retainedPeriodPayment ?? openSuccessionRetentions;
    if (await retained.hasRetainedPeriodPayment({ subscriptionId: subscription.id }))
        return { outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' };

    if (await isLiveSuccessionPredecessor({ subscriptionId: subscription.id })) {
        logger.info(
            { subscriptionId: subscription.id, event: value.event },
            'Arrears suspension waits for the live succession to end'
        );
        return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSION_IN_PROGRESS' };
    }

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
        await recordAuthorizationSeenAlive({
            annotator,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
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
            else
                await recordAuthorizationSeenAlive({
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

    const suspendedAt = ports.clock.now();
    const writeInput =
        origin === 'ACTIVE'
            ? {
                  subscriptionId: subscription.id,
                  origin,
                  now: suspendedAt,
                  readAt: authorization.readAt,
                  coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
              }
            : {
                  subscriptionId: subscription.id,
                  origin,
                  now: suspendedAt,
                  coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
              };
    const write = await writeArrearsSuspension(writeInput);
    if (write === 'RETAINED_PAYMENT')
        return { outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' };
    if (write === 'LOST_RACE') return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
    const suspendedFact = buildSuspendedFact({
        subscription,
        occurredAt: suspendedAt,
        trigger: value.event,
        occurrenceId: value.occurrenceId
    });
    if (suspendedFact) emitBillingFact({ sink: ports.billingFacts, fact: suspendedFact });
    let complements: PauseComplementsSummary | undefined;
    if (ports.complements) {
        try {
            complements = await pauseComplementsS32(
                { principalSubscriptionId: subscription.id, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: ports.provider, clock: ports.clock, policy: ports.complements }
            );
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'S32 could not pause complements after suspension'
            );
        }
    } else {
        logger.warn({ subscriptionId: subscription.id }, 'S32 complement ports are not wired');
    }
    logger.info(
        { subscriptionId: subscription.id, event: value.event, cancelCall },
        'Subscription suspended for arrears'
    );
    return {
        outcome: 'SUSPENDED',
        subscriptionId: subscription.id,
        cancelCall,
        ...(complements === undefined ? {} : { complements }),
        ...(escalated ? { escalated } : {})
    };
}
