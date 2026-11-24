import { sendAccessEndingNotices, sendRenewalNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Outcome of one pass: its summary, or the message of what it threw. */
type PassOutcome<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: string };

/** One line for the run message: what a pass enqueued, or why it failed. */
function describePass(outcome: PassOutcome<{ readonly enqueued: number }>): string {
    return outcome.ok ? `${outcome.value.enqueued} enqueued` : `failed (${outcome.error})`;
}

/** The failure message of a pass, or undefined when it succeeded. */
function describeError(outcome: PassOutcome<unknown>): string | undefined {
    return outcome.ok ? undefined : outcome.error;
}

/**
 * Runs one pass of the job and turns a throw into a logged failure, so the next pass
 * still runs.
 *
 * @param input.run - The pass
 * @param input.onError - Logs the failure message
 * @returns The summary, or the failure message
 */
async function runPass<T>(input: {
    readonly run: () => Promise<T>;
    readonly onError: (message: string) => void;
}): Promise<PassOutcome<T>> {
    try {
        return { ok: true, value: await input.run() };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        input.onError(message);
        return { ok: false, error: message };
    }
}

/**
 * The 06:00 reconciliation sweep copies `next_charge_at` from Mercado Pago (HOS-1685);
 * this 09:00 cron reads that value to enqueue renewal notices.
 *
 * The same run enqueues the access-ending reminder of every `CANCEL_SCHEDULED` principal
 * whose service ends inside the largest PLAZO:13 offset (HOS-2580 §C): both are "your cycle
 * is about to close" notices on the same offsets, so they share one job instead of a new one.
 */
export const subscriptionRenewalNoticeJob: CronJobDefinition = {
    name: 'subscription-renewal-notice',
    description:
        'Enqueue the renewal notice at the PLAZO:13 offsets before the next charge, with the deadline version stored per cycle (HOS-1622, AC:B13a:13), and the access-ending reminder of scheduled cancellations (HOS-2580)',
    schedule: '0 9 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping renewal notices');
            return {
                success: true,
                message: 'Dry run - no renewal notices enqueued',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        const clock = getClock().clock;
        // The two passes are isolated: one throwing never skips the other (HOS-2580 review).
        const renewal = await runPass({
            run: () => sendRenewalNotices({ limit: 1000 }, { clock }),
            onError: (error) => logger.error('Renewal notices failed', { error })
        });
        const accessEnding = await runPass({
            run: () => sendAccessEndingNotices({ limit: 1000 }, { clock }),
            onError: (error) => logger.error('Access-ending notices failed', { error })
        });
        const durationMs = Date.now() - startedAt.getTime();
        const renewalSummary = renewal.ok ? renewal.value : undefined;
        const accessSummary = accessEnding.ok ? accessEnding.value : undefined;
        const processed = (renewalSummary?.enqueued ?? 0) + (accessSummary?.enqueued ?? 0);
        const errors = (renewalSummary?.failed ?? 1) + (accessSummary?.failed ?? 1);
        logger.info('Renewal notices completed', {
            renewalOk: renewal.ok,
            accessEndingOk: accessEnding.ok,
            enqueued: renewalSummary?.enqueued,
            alreadyEnqueued: renewalSummary?.alreadyEnqueued,
            stamped: renewalSummary?.stamped,
            notDue: renewalSummary?.notDue,
            skipped: renewalSummary?.skipped,
            failed: renewalSummary?.failed,
            accessEndingEnqueued: accessSummary?.enqueued,
            accessEndingAlreadyEnqueued: accessSummary?.alreadyEnqueued,
            accessEndingFailed: accessSummary?.failed,
            durationMs
        });
        return {
            success: renewal.ok && accessEnding.ok,
            message: `Renewal notices: ${describePass(renewal)}; access-ending notices: ${describePass(accessEnding)}`,
            processed,
            errors,
            durationMs,
            details: {
                ...(renewalSummary
                    ? {
                          enqueued: renewalSummary.enqueued,
                          alreadyEnqueued: renewalSummary.alreadyEnqueued,
                          stamped: renewalSummary.stamped,
                          notDue: renewalSummary.notDue,
                          skipped: renewalSummary.skipped,
                          failed: renewalSummary.failed
                      }
                    : { error: describeError(renewal) }),
                accessEnding: accessSummary
                    ? {
                          enqueued: accessSummary.enqueued,
                          alreadyEnqueued: accessSummary.alreadyEnqueued,
                          notDue: accessSummary.notDue,
                          failed: accessSummary.failed
                      }
                    : { error: describeError(accessEnding) }
            }
        };
    }
};
