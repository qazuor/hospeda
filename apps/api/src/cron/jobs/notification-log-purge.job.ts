/**
 * Notification Log Purge Cron Job
 *
 * Periodically purges old notification log entries using the
 * NotificationRetentionService. Runs daily at 3:00 UTC (midnight Argentina time).
 *
 * Retention policy:
 * - Records older than 90 days are marked as expired (soft delete)
 * - Records expired for more than 30 days are permanently deleted (hard delete)
 *
 * @module cron/jobs/notification-log-purge
 */

import { NotificationRetentionService } from '../../services/notification-retention.service.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Notification log purge cron job definition
 *
 * Schedule: Daily at 3:00 UTC (midnight Argentina time)
 * Purpose: Clean up old notification log entries to prevent unbounded table growth
 */
export const notificationLogPurgeJob: CronJobDefinition = {
    name: 'notification-log-purge',
    description: 'Purge old notification log entries (90-day retention + 30-day grace)',
    schedule: '0 3 * * *', // Daily at 3:00 UTC
    enabled: true,
    timeoutMs: 60000, // 1 minute timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting notification log purge job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            logger.info('Dry run mode - skipping actual purge');
            return {
                success: true,
                message: 'Dry run - no records purged',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const retentionService = new NotificationRetentionService();
            const summary = await retentionService.runRetentionPolicy();

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Notification log purge job completed', {
                markedExpired: summary.markedExpired,
                purged: summary.purged,
                durationMs
            });

            return {
                success: true,
                message: `Marked ${summary.markedExpired} expired, purged ${summary.purged} old records`,
                processed: summary.markedExpired + summary.purged,
                errors: 0,
                durationMs,
                details: {
                    markedExpired: summary.markedExpired,
                    purged: summary.purged
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Notification log purge job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to purge notification logs: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
