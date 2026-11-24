import { sendAccessEndingNotices, sendRenewalNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/**
 * The 06:00 reconciliation sweep copies `next_charge_at` from Mercado Pago (HOS-1685);
 * this 09:00 cron reads that value to enqueue renewal notices.
 *
 * The same run enqueues the access-ending reminder of every `CANCEL_SCHEDULED` principal
 * whose service ends inside the larger PLAZO:13 offset (HOS-2580 §C): both are "your cycle
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

        try {
            const clock = getClock().clock;
            const summary = await sendRenewalNotices({ limit: 1000 }, { clock });
            const accessEnding = await sendAccessEndingNotices({ limit: 1000 }, { clock });
            const processed = summary.enqueued + accessEnding.enqueued;
            const errors = summary.failed + accessEnding.failed;
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Renewal notices completed', {
                enqueued: summary.enqueued,
                alreadyEnqueued: summary.alreadyEnqueued,
                stamped: summary.stamped,
                notDue: summary.notDue,
                skipped: summary.skipped,
                failed: summary.failed,
                accessEndingEnqueued: accessEnding.enqueued,
                accessEndingAlreadyEnqueued: accessEnding.alreadyEnqueued,
                accessEndingFailed: accessEnding.failed,
                durationMs
            });
            return {
                success: true,
                message: `Enqueued ${summary.enqueued} renewal notices and ${accessEnding.enqueued} access-ending notices`,
                processed,
                errors,
                durationMs,
                details: {
                    enqueued: summary.enqueued,
                    alreadyEnqueued: summary.alreadyEnqueued,
                    stamped: summary.stamped,
                    notDue: summary.notDue,
                    skipped: summary.skipped,
                    failed: summary.failed,
                    accessEnding: {
                        enqueued: accessEnding.enqueued,
                        alreadyEnqueued: accessEnding.alreadyEnqueued,
                        notDue: accessEnding.notDue,
                        failed: accessEnding.failed
                    }
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Renewal notices failed', { error: message });
            return {
                success: false,
                message: `Renewal notices failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
