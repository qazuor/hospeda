import { sendGraceReminders } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Enqueues configured grace-period reminder milestones once per local target date. */
export const subscriptionGraceReminderJob: CronJobDefinition = {
    name: 'subscription-grace-reminder',
    description: 'Enqueue configured reminders before the end of a subscription grace period.',
    schedule: '0 9 * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun)
            return {
                success: true,
                message: 'Dry run - no grace reminders enqueued',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        try {
            const summary = await sendGraceReminders({ limit: 1000 }, { clock: getClock().clock });
            logger.info('Grace reminders completed', { ...summary, rows: undefined });
            return {
                success: true,
                message: `Enqueued ${summary.enqueued} grace reminders`,
                processed: summary.enqueued,
                errors: summary.failed,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    enqueued: summary.enqueued,
                    alreadyEnqueued: summary.alreadyEnqueued,
                    notDue: summary.notDue,
                    noDeadline: summary.noDeadline,
                    skipped: summary.skipped,
                    failed: summary.failed
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Grace reminders failed', { error: message });
            return {
                success: false,
                message: `Grace reminders failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
