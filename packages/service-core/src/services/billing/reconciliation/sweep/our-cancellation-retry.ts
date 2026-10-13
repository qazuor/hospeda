import type { Clock } from '@repo/billing-verticals-contract';
import {
    reconciliationInventoryModel,
    reconciliationMarkModel,
    type SelectProviderLink,
    type SelectSubscription
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type ActStart,
    type AuthorizationSnapshot,
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    type ProviderRead
} from '@repo/payments';
import type { BeforeCancelNotice } from '../../subscription/start-subscription.service.js';
import { cancelOurAuthorization } from '../cancel-our-authorization.js';
import { openReconciliationMark } from '../open-reconciliation-mark.service.js';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';

const logger = createLogger('our-cancellation-retry');

/**
 * Up to 3 days after the transition, by time and not by runs (DEC-CONC-002 📌1; MOT:16). It
 * is not a key of the deadlines table (B11's are 16-19).
 */
export const OUR_CANCELLATION_RETRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** What one retry of our decided cancellation ended in. */
export type OurCancellationRetryOutcome =
    | 'STOPPED'
    | 'CONFIRMED'
    | 'MARKED'
    | 'NOTICE_PENDING'
    | 'CALL_FAILED'
    | 'SENT_UNCONFIRMED';

/** Input of {@link retryOurCancellation}. */
export interface RetryOurCancellationInput {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink;
    /** The recorded decision: its transition code and instant start the 3-day clock. */
    readonly decision: { readonly transition: string; readonly decidedAt: Date };
    readonly correlationId: string;
    /** The live loop's read by id of this row, with the act it was taken for. */
    readonly prior?: {
        readonly read: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    };
}

/** Ports of {@link retryOurCancellation}. */
export interface RetryOurCancellationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly markPayments?: ReconciliationMarkPayments;
}

/** Result of {@link retryOurCancellation}. */
export interface RetryOurCancellationResult {
    readonly outcome: OurCancellationRetryOutcome;
    /** Whether this attempt read the authorization (its own read or the live loop's). */
    readonly read: boolean;
    /** The mark's outcome, when the window ran out. */
    readonly markOutcome?: 'OPENED' | 'ACCUMULATED';
}

/**
 * Retries the cancellation one of OUR transitions already decided (AC:B11:6, exceptions 1 and
 * 4): the same act, with the notice first and the re-read after, until 3 days after the
 * decision; then it opens `CANCELACION_SIN_CONFIRMAR` and stops retrying. It never touches
 * money: its only writes are that mark (through S14) and what the notice enqueues.
 *
 * 1. An open `CANCELACION_SIN_CONFIRMAR` on the row stops it: no read, no call, no notice.
 * 2. Reads by id (or reuses the live loop's fresh read; never a loose state, G17).
 * 3. `cancelled` → `CONFIRMED`.
 * 4. With the window elapsed → opens mark 16, without calling the provider. Its
 *    `reconciliation.mark_opened` event is the alert on the DEC-OBS-001 channel.
 * 5. Otherwise → `cancelOurAuthorization`. The notice uses the default occurrence (the
 *    subscription id), the same S3 and S16 used, so it goes out once per cancellation.
 *
 * @param input - The row, its link, its decision, the correlation and an optional prior read
 * @param ports - Provider, clock, the before-cancel notice and the optional mark payments port
 * @returns The outcome, whether the row was read and the mark outcome when one was opened
 * @throws when the read by id fails (the caller counts the row as failed)
 */
export async function retryOurCancellation(
    input: RetryOurCancellationInput,
    ports: RetryOurCancellationPorts
): Promise<RetryOurCancellationResult> {
    const subject = { kind: 'SUBSCRIPTION' as const, subscriptionId: input.subscription.id };
    const open = await reconciliationMarkModel.findOpen({
        subject,
        reason: 'CANCELACION_SIN_CONFIRMAR'
    });
    if (open) return { outcome: 'STOPPED', read: false };

    let prior = input.prior;
    if (!prior) {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: input.providerLink.providerId
        });
        prior = { read, act };
    }
    const fresh = assertFreshForAct({ read: prior.read, act: prior.act });
    if (fresh.snapshot.status === 'cancelled') return { outcome: 'CONFIRMED', read: true };

    const deadline = input.decision.decidedAt.getTime() + OUR_CANCELLATION_RETRY_WINDOW_MS;
    if (ports.clock.now().getTime() >= deadline) {
        const opened = await openReconciliationMark(
            {
                subject,
                reason: 'CANCELACION_SIN_CONFIRMAR',
                actor: { type: 'job' },
                correlationId: input.correlationId
            },
            ports.markPayments ? { markPayments: ports.markPayments } : {}
        );
        logger.warn(
            {
                subscriptionId: input.subscription.id,
                transition: input.decision.transition,
                markOutcome: opened.outcome
            },
            'Our cancellation stayed unconfirmed for 3 days; mark 16 opened, retries stop'
        );
        return { outcome: 'MARKED', read: true, markOutcome: opened.outcome };
    }

    const { outcome } = await cancelOurAuthorization(
        {
            subscriptionId: input.subscription.id,
            userId: input.subscription.userId,
            authorizationId: input.providerLink.providerId,
            prior
        },
        {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: ports.beforeCancelNotice
        }
    );
    return { outcome: outcome === 'ALREADY_CANCELLED' ? 'CONFIRMED' : outcome, read: true };
}

/** Counts of one retry pass, by outcome. */
export interface OurCancellationRetryCounts {
    readonly stopped: number;
    readonly confirmed: number;
    readonly marked: number;
    readonly noticePending: number;
    readonly callFailed: number;
    readonly sentUnconfirmed: number;
}

/** Summary of {@link runOurCancellationRetry}. */
export interface OurCancellationRetrySummary extends OurCancellationRetryCounts {
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly failures: ReadonlyArray<{ readonly subscriptionId: string; readonly message: string }>;
}

const COUNT_KEY: Record<OurCancellationRetryOutcome, keyof OurCancellationRetryCounts> = {
    STOPPED: 'stopped',
    CONFIRMED: 'confirmed',
    MARKED: 'marked',
    NOTICE_PENDING: 'noticePending',
    CALL_FAILED: 'callFailed',
    SENT_UNCONFIRMED: 'sentUnconfirmed'
};

/** A mutable tally of retry outcomes, shared by the pass and the live loop. */
export function createOurCancellationRetryTally() {
    const counts: Record<keyof OurCancellationRetryCounts, number> = {
        stopped: 0,
        confirmed: 0,
        marked: 0,
        noticePending: 0,
        callFailed: 0,
        sentUnconfirmed: 0
    };
    return {
        add(outcome: OurCancellationRetryOutcome): void {
            counts[COUNT_KEY[outcome]]++;
        },
        snapshot(): OurCancellationRetryCounts {
            return { ...counts };
        }
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * The retry pass over the terminal population (AC:B11:6): walks `listCancellationRetryPage`
 * by keyset and retries each row. One row's error is caught, counted and noted (never the
 * provider's body) and the pass goes on. A `CANCEL_SCHEDULED` row is live, so it is not here:
 * the sweep's live loop retries it.
 *
 * @param input - The sweep's correlation id and page size
 * @param ports - Provider, clock, the before-cancel notice and the optional mark payments port
 * @returns Counts by outcome, rows read, rows failed and the failures
 */
export async function runOurCancellationRetry(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: RetryOurCancellationPorts
): Promise<OurCancellationRetrySummary> {
    const tally = createOurCancellationRetryTally();
    const failures: Array<{ readonly subscriptionId: string; readonly message: string }> = [];
    let rowsRead = 0;
    let afterSubscriptionId: string | undefined;
    for (;;) {
        const page = await reconciliationInventoryModel.listCancellationRetryPage({
            afterSubscriptionId,
            limit: input.pageSize
        });
        for (const row of page) {
            try {
                const result = await retryOurCancellation(
                    {
                        subscription: row.subscription,
                        providerLink: row.providerLink,
                        decision: row.decision,
                        correlationId: input.correlationId
                    },
                    ports
                );
                if (result.read) rowsRead++;
                tally.add(result.outcome);
            } catch (error) {
                const message = errorMessage(error);
                failures.push({ subscriptionId: row.subscription.id, message });
                logger.error(
                    { subscriptionId: row.subscription.id, error: message },
                    'Our cancellation retry failed for one row'
                );
            }
        }
        if (page.length < input.pageSize) break;
        afterSubscriptionId = page.at(-1)?.subscription.id;
    }
    return { ...tally.snapshot(), rowsRead, rowsFailed: failures.length, failures };
}
