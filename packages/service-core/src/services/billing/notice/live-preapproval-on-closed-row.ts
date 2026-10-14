import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    domainEvent,
    eq,
    getDb,
    providerLinks,
    reconciliationInventoryModel,
    type SelectProviderLink,
    type SelectSubscription,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { type CanChargeDeadlines, cancellationRereadWindowEndsAt } from '../coverage/can-charge.js';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service.js';
import {
    type CancelOurAuthorizationResult,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port.js';
import {
    type RetryOurCancellationResult,
    retryOurCancellation
} from '../reconciliation/sweep/our-cancellation-retry.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';

const logger = createLogger('live-preapproval-on-closed-row');

/** The states this pair covers (B/03 §10.1): `CANCEL_SCHEDULED` and the three terminal ones. */
const CLOSED_STATUSES: readonly string[] = [
    'CANCEL_SCHEDULED',
    'CANCELLED',
    'ABANDONED',
    'CHARGE_DECLINED'
];

/** S16's terminal state: its row without a decision is the one S16 left without a call. */
const CHARGE_DECLINED = 'CHARGE_DECLINED';

/** The mirror's mark of «cancelled by the provider after a rejection» (HOS-1676 H-2). */
const PROVIDER_CANCELLED_AFTER_REJECTION = 'subscription.provider_cancelled_after_rejection';

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    readAt: z.date(),
    cancelledSeenAt: z.date().nullable()
});

/** Input of {@link handleLivePreapprovalOnClosedRow}. */
export interface LivePreapprovalOnClosedRowInput {
    /** The `CANCEL_SCHEDULED` or terminal row whose preapproval the re-read saw alive. */
    readonly subscriptionId: string;
    /** The instant of the read by id that saw it `authorized`, `paused` or `pending`. */
    readonly readAt: Date;
    /**
     * `provider_link.cancelled_seen_at` as loaded BEFORE that read emptied it (H-4): the live
     * re-read runs before this handler and clears the column, so it is passed in.
     */
    readonly cancelledSeenAt: Date | null;
}

/** Ports of {@link handleLivePreapprovalOnClosedRow}. */
export interface LivePreapprovalOnClosedRowPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    /** Hangs payments from the marks this handler opens (S14). */
    readonly markPayments?: ReconciliationMarkPayments;
    /** The billing deadlines (PLAZO:16); defaults to `getCurrentBillingDeadlines()`. */
    readonly deadlines?: CanChargeDeadlines;
}

/** Result of {@link handleLivePreapprovalOnClosedRow}. */
export type LivePreapprovalOnClosedRowResult =
    | { readonly outcome: 'RETRIED'; readonly retry: RetryOurCancellationResult }
    | {
          readonly outcome: 'CANCELLATION_SENT';
          readonly decisionEventId: string;
          readonly cancellation: CancelOurAuthorizationResult;
      }
    | { readonly outcome: 'DIVERGENCE_MARKED'; readonly markOutcome: 'OPENED' | 'ACCUMULATED' }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason: 'NOT_FOUND' | 'NOT_CLOSED' | 'NO_PROVIDER_LINK';
      };

const currentBillingDeadlines: CanChargeDeadlines = {
    current: getCurrentBillingDeadlines
};

type ClosedRow = { readonly subscription: SelectSubscription; readonly link: SelectProviderLink };

async function readClosedRow(
    subscriptionId: string
): Promise<ClosedRow | LivePreapprovalOnClosedRowResult> {
    const [row] = await getDb()
        .select({ subscription: subscriptions, link: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NOT_FOUND' };
    if (!CLOSED_STATUSES.includes(row.subscription.status))
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CLOSED' };
    if (!row.link) return { outcome: 'NOT_APPLICABLE', reason: 'NO_PROVIDER_LINK' };
    return { subscription: row.subscription, link: row.link };
}

/** Whether the mirror left this row `CANCELLED` after a rejection (the H-2 event). */
async function wasCancelledAfterRejection(subscriptionId: string): Promise<boolean> {
    const [event] = await getDb()
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, PROVIDER_CANCELLED_AFTER_REJECTION)
            )
        )
        .limit(1);
    return event !== undefined;
}

async function retry(
    closed: ClosedRow,
    decision: { readonly transition: string; readonly decidedAt: Date },
    ports: LivePreapprovalOnClosedRowPorts
): Promise<LivePreapprovalOnClosedRowResult> {
    const result = await retryOurCancellation(
        {
            subscription: closed.subscription,
            providerLink: closed.link,
            decision: { transition: decision.transition, decidedAt: decision.decidedAt },
            correlationId: crypto.randomUUID()
        },
        {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: ports.beforeCancelNotice,
            ...(ports.markPayments ? { markPayments: ports.markPayments } : {})
        }
    );
    logger.info(
        { subscriptionId: closed.subscription.id, retry: result.outcome },
        'Live preapproval on a closed row: retried our decided cancellation'
    );
    return { outcome: 'RETRIED', retry: result };
}

/**
 * The `B/03` §10.1 pair `LIVE_PREAPPROVAL_ON_CLOSED_ROW` (HOS-1676 H-7): a read by id saw the
 * preapproval `authorized`, `paused` or `pending` while our row is `CANCEL_SCHEDULED` or
 * terminal. It decides from OUR columns only (G17 (b): the provider status reached the
 * receiver through the read by id; here only its instant arrives), in this order:
 *
 * - (a) the row has a recorded cancellation decision (exceptions 1 and 4, or S11's
 *   `CANCEL_SCHEDULED`) → `retryOurCancellation` without `prior` (it re-reads by id itself):
 *   the sweep's same act, with its 3-day clock from the decision and its mark 16.
 * - (b) no decision, the row is S16's `CHARGE_DECLINED` or the mirror's `CANCELLED` after a
 *   rejection (the H-2 event), `cancelledSeenAt` is set and `readAt` is inside PLAZO:16 from it
 *   → in ONE transaction it locks the row, re-checks there is still no decision (a concurrent
 *   notice that won falls to (a)) and records `REJECTION_REVIVED` with `decidedAt = readAt`;
 *   after the commit, `cancelOurAuthorization` sends the cancellation S16 would have sent
 *   (notice first, re-read after). From then on the row is exception 4 (B11 §3).
 * - (c) anything else → `TRANSICION_NO_DECLARADA` (a real divergence, S14).
 *
 * A business answer never throws. It throws on a read error and when no billing deadlines
 * version is in force (fails closed: the notice stays `ERROR` and the provider retries).
 *
 * @param input - The row, the read instant and the cancellation-seen column read before it
 * @param ports - Provider, clock, the before-cancel notice and the optional marks and deadlines
 * @returns Which branch ran and its outcome, or `NOT_APPLICABLE` when the row is no longer closed
 */
export async function handleLivePreapprovalOnClosedRow(
    input: LivePreapprovalOnClosedRowInput,
    ports: LivePreapprovalOnClosedRowPorts
): Promise<LivePreapprovalOnClosedRowResult> {
    const value = inputSchema.parse(input);
    const closed = await readClosedRow(value.subscriptionId);
    if ('outcome' in closed) return closed;

    // (a) our cancellation, decided and not yet confirmed.
    const decision = await reconciliationInventoryModel.findCancellationDecision({
        subscriptionId: value.subscriptionId
    });
    if (decision) return retry(closed, decision, ports);

    // (b) the terminal the provider cancelled after a rejection, revived inside PLAZO:16.
    const rejectionTerminal =
        closed.subscription.status === CHARGE_DECLINED ||
        (closed.subscription.status === 'CANCELLED' &&
            (await wasCancelledAfterRejection(value.subscriptionId)));
    if (rejectionTerminal && value.cancelledSeenAt !== null) {
        const deadlines = await (ports.deadlines ?? currentBillingDeadlines).current();
        const days = deadlines.values['16']?.days;
        if (typeof days !== 'number')
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'The billing deadlines in force have no 16th deadline',
                undefined,
                'BILLING_DEADLINE_16_MISSING'
            );
        const endsAt = cancellationRereadWindowEndsAt({ seenAt: value.cancelledSeenAt, days });
        if (value.readAt.getTime() < endsAt.getTime())
            return reviveRejection(closed, value.readAt, ports);
    }

    // (c) a real divergence.
    const correlationId = crypto.randomUUID();
    const opened = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: value.subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId
        },
        ports.markPayments ? { markPayments: ports.markPayments } : {}
    );
    logger.warn(
        { subscriptionId: value.subscriptionId, status: closed.subscription.status, correlationId },
        'Live preapproval on a closed row with no declared transition; divergence marked'
    );
    return { outcome: 'DIVERGENCE_MARKED', markOutcome: opened.outcome };
}

async function reviveRejection(
    closed: ClosedRow,
    readAt: Date,
    ports: LivePreapprovalOnClosedRowPorts
): Promise<LivePreapprovalOnClosedRowResult> {
    const subscriptionId = closed.subscription.id;
    const correlationId = crypto.randomUUID();
    const recorded = await getDb().transaction(async (tx) => {
        const [locked] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1)
            .for('update');
        if (!locked || locked.status !== closed.subscription.status)
            return { kind: 'CHANGED' as const };
        const existing = await reconciliationInventoryModel.findCancellationDecision({
            subscriptionId,
            tx
        });
        if (existing) return { kind: 'DECIDED' as const, decision: existing };
        const { eventId } = await recordProviderCancellationDecided({
            subscriptionId,
            transition: 'REJECTION_REVIVED',
            decidedAt: readAt,
            actor: { type: 'provider' },
            correlationId,
            changes: [],
            tx
        });
        return { kind: 'RECORDED' as const, eventId };
    });
    if (recorded.kind === 'DECIDED') return retry(closed, recorded.decision, ports);
    if (recorded.kind === 'CHANGED') {
        logger.info(
            { subscriptionId },
            'Live preapproval on a closed row: the row changed state before the decision'
        );
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CLOSED' };
    }

    const cancellation = await cancelOurAuthorization(
        {
            subscriptionId,
            userId: closed.subscription.userId,
            authorizationId: closed.link.providerId
        },
        {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: ports.beforeCancelNotice
        }
    );
    logger.info(
        { subscriptionId, correlationId, cancellation: cancellation.outcome },
        'Revived rejection terminal: REJECTION_REVIVED recorded and its cancellation sent'
    );
    return { outcome: 'CANCELLATION_SENT', decisionEventId: recorded.eventId, cancellation };
}
