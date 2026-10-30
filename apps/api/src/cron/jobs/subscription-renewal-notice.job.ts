import { sendRenewalNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/**
 * The 06:00 reconciliation sweep copies `next_charge_at` from Mercado Pago (HOS-1685);
 * this 09:00 cron reads that value to enqueue renewal notices.
 */
export const subscriptionRenewalNoticeJob: CronJobDefinition = {
    name: 'subscription-renewal-notice',
    description:
        'Enqueue the renewal notice at the PLAZO:13 offsets before the next charge, with the deadline version stored per cycle (HOS-1622, AC:B13a:13)',
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
            const summary = await sendRenewalNotices({ limit: 1000 }, { clock: getClock().clock });
            const processed = summary.enqueued;
            const errors = summary.failed;
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Renewal notices completed', {
                enqueued: summary.enqueued,
                alreadyEnqueued: summary.alreadyEnqueued,
                stamped: summary.stamped,
                notDue: summary.notDue,
                skipped: summary.skipped,
                failed: summary.failed,
                durationMs
            });
            return {
                success: true,
                message: `Enqueued ${processed} renewal notices`,
                processed,
                errors,
                durationMs,
                details: {
                    enqueued: summary.enqueued,
                    alreadyEnqueued: summary.alreadyEnqueued,
                    stamped: summary.stamped,
                    notDue: summary.notDue,
                    skipped: summary.skipped,
                    failed: summary.failed
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
