import { sendPlanMigrationNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Enqueue retirement migration reminders after the 06:00 next-charge sync. */
export const planMigrationNoticeJob: CronJobDefinition = {
    name: 'plan-migration-notice',
    description: 'Enqueue due retirement migration reminders for each customer (HOS-1613).',
    schedule: '17 9 * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        const clock = getClock().clock;
        if (dryRun) {
            logger.info('Dry run mode - skipping plan migration notices');
            return {
                success: true,
                message: 'Dry run - no plan migration notices enqueued',
                processed: 0,
                errors: 0,
                durationMs: clock.now().getTime() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await sendPlanMigrationNotices({ limit: 1000 }, { clock });
            const durationMs = clock.now().getTime() - startedAt.getTime();
            logger.info('Plan migration notices completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Enqueued ${summary.enqueued} plan migration notices`,
                processed: summary.enqueued,
                errors: summary.failed,
                durationMs,
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Plan migration notices failed', { error: message });
            return {
                success: false,
                message: `Plan migration notices failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: clock.now().getTime() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
