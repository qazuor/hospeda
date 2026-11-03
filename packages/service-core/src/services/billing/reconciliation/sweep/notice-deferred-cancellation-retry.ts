/**
 * Retries recent terminal rows whose deciding before-cancel notice has settled. A recent open
 * reconciliation sweep blocks this pass because provider cancellation is not idempotent.
 * This service uses the sweep's retry policy; it never invokes provider cancellation or the
 * direct cancellation helper itself, and it never touches money.
 */
import { reconciliationInventoryModel, reconciliationSweepRunModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import type { ProviderCancellationTransition } from '../provider-cancellation-decision.js';
import type { BeforeCancelNoticeStatusReader } from './before-cancel-notice-status.port.js';
import {
    BEFORE_CANCEL_KIND_BY_TRANSITION,
    createOurCancellationRetryTally,
    OUR_CANCELLATION_RETRY_WINDOW_MS,
    type OurCancellationRetryCounts,
    type RetryOurCancellationPorts,
    retryOurCancellation
} from './our-cancellation-retry.js';

const logger = createLogger('notice-deferred-cancellation-retry');

/** D-3: only notices settled within 30 minutes are retried by this frequent pass. */
export const NOTICE_DEFERRED_RETRY_SETTLED_WITHIN_MS = 30 * 60 * 1000;
/** D-5: at most ten provider retries per pass. */
export const NOTICE_DEFERRED_RETRY_MAX_ROWS = 10;
/** Keyset page size for bounded database reads. */
export const NOTICE_DEFERRED_RETRY_PAGE_SIZE = 100;

const inputSchema = z.object({
    correlationId: z.string().min(1),
    sweepRunMaxAgeMs: z.number().int().positive(),
    maxRows: z.number().int().positive().optional()
});

/** Validated input for the frequent retry pass. */
export type NoticeDeferredCancellationRetryInput = z.input<typeof inputSchema>;

/** Dependencies for the frequent retry pass. */
export type NoticeDeferredCancellationRetryPorts = RetryOurCancellationPorts & {
    readonly noticeStatus: BeforeCancelNoticeStatusReader;
};

/** One failed row, without provider response content. */
export interface NoticeDeferredCancellationRetryFailure {
    readonly subscriptionId: string;
    readonly message: string;
}

/** Summary of one frequent retry pass. */
export interface NoticeDeferredCancellationRetrySummary {
    readonly skipped?: 'SWEEP_RUNNING';
    readonly candidates: number;
    readonly noRecipient: number;
    readonly undeclared: number;
    readonly noticePending: number;
    readonly noticeAbsent: number;
    readonly settledLongAgo: number;
    readonly deferredToNextRun: number;
    readonly retried: OurCancellationRetryCounts;
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly failures: ReadonlyArray<NoticeDeferredCancellationRetryFailure>;
}

/** Retries recent decided cancellations after their original notice settles. */
export async function runNoticeDeferredCancellationRetry(
    input: NoticeDeferredCancellationRetryInput,
    ports: NoticeDeferredCancellationRetryPorts
): Promise<NoticeDeferredCancellationRetrySummary> {
    const parsed = inputSchema.parse(input);
    const tally = createOurCancellationRetryTally();
    const failures: NoticeDeferredCancellationRetryFailure[] = [];
    const counts = {
        candidates: 0,
        noRecipient: 0,
        undeclared: 0,
        noticePending: 0,
        noticeAbsent: 0,
        settledLongAgo: 0,
        deferredToNextRun: 0,
        rowsRead: 0
    };
    const now = ports.clock.now();
    const open = await reconciliationSweepRunModel.findOpenStartedSince({
        since: new Date(now.getTime() - parsed.sweepRunMaxAgeMs)
    });
    if (open) {
        return {
            skipped: 'SWEEP_RUNNING',
            ...counts,
            retried: tally.totals(),
            rowsFailed: 0,
            failures
        };
    }

    const maxRows = parsed.maxRows ?? NOTICE_DEFERRED_RETRY_MAX_ROWS;
    let retriedRows = 0;
    let afterSubscriptionId: string | undefined;
    for (;;) {
        const page = await reconciliationInventoryModel.listCancellationRetryPage({
            afterSubscriptionId,
            limit: NOTICE_DEFERRED_RETRY_PAGE_SIZE,
            unconfirmedOnly: true,
            decidedSince: new Date(now.getTime() - OUR_CANCELLATION_RETRY_WINDOW_MS)
        });
        for (const row of page) {
            counts.candidates++;
            try {
                const userId = row.subscription.userId;
                if (userId === null) {
                    counts.noRecipient++;
                    continue;
                }
                const transition = row.decision.transition;
                const kind = Object.hasOwn(BEFORE_CANCEL_KIND_BY_TRANSITION, transition)
                    ? BEFORE_CANCEL_KIND_BY_TRANSITION[transition as ProviderCancellationTransition]
                    : 'UNDECLARED';
                if (kind === 'RECIPIENTLESS') {
                    counts.noRecipient++;
                    continue;
                }
                if (kind === 'UNDECLARED') {
                    counts.undeclared++;
                    continue;
                }
                const notice = await ports.noticeStatus.read({
                    subscriptionId: row.subscription.id,
                    userId,
                    kind
                });
                if (notice.state === 'PENDING') {
                    counts.noticePending++;
                    continue;
                }
                if (notice.state === 'ABSENT') {
                    counts.noticeAbsent++;
                    continue;
                }
                if (
                    notice.settledAgeMs === null ||
                    notice.settledAgeMs > NOTICE_DEFERRED_RETRY_SETTLED_WITHIN_MS
                ) {
                    counts.settledLongAgo++;
                    continue;
                }
                if (retriedRows >= maxRows) {
                    counts.deferredToNextRun++;
                    continue;
                }
                retriedRows++;
                const result = await retryOurCancellation(
                    {
                        subscription: row.subscription,
                        providerLink: row.providerLink,
                        decision: row.decision,
                        correlationId: parsed.correlationId
                    },
                    ports
                );
                if (result.read) counts.rowsRead++;
                tally.add(result.outcome);
            } catch (error) {
                const message = error instanceof Error ? error.name : 'UnknownError';
                failures.push({ subscriptionId: row.subscription.id, message });
                logger.error(
                    { subscriptionId: row.subscription.id, errorName: message },
                    'Deferred cancellation retry failed for one row'
                );
            }
        }
        if (page.length < NOTICE_DEFERRED_RETRY_PAGE_SIZE) break;
        afterSubscriptionId = page.at(-1)?.subscription.id;
    }
    return { ...counts, retried: tally.totals(), rowsFailed: failures.length, failures };
}
