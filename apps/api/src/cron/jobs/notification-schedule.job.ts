/**
 * Retries due notifications from the shared Redis queue.
 * Legacy trial and subscription dispatch was removed with the old billing system.
 *
 * @module cron/jobs/notification-schedule
 */
import { billingNotificationLog, eq, getDb } from '@repo/db';
import { type NotificationPayload, RetryService } from '@repo/notifications';
import { trySendNotification } from '../../utils/notification-helper.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobDefinition } from '../types.js';

/** Daily sweep for notifications that the mail service queued for retry. */
export const notificationScheduleJob: CronJobDefinition = {
    name: 'notification-schedule',
    description: 'Retry scheduled notification deliveries',
    schedule: '0 8 * * *',
    enabled: true,
    timeoutMs: 120000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            return {
                success: true,
                message: 'Dry run - no notifications retried',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime()
            };
        }

        try {
            const redis = await getRedisClient();
            if (!redis) {
                logger.warn('Notification retry queue unavailable');
                return {
                    success: true,
                    message: 'Notification retry queue unavailable',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const retryService = new RetryService(redis, {
                onPermanentFailure: async (notification) => {
                    await getDb()
                        .update(billingNotificationLog)
                        .set({ status: 'permanently_failed', errorMessage: notification.lastError })
                        .where(eq(billingNotificationLog.id, notification.id));
                }
            });
            const stats = await retryService.processRetries(async (payload: unknown) => {
                const outcome = await trySendNotification(payload as NotificationPayload);
                return {
                    success: outcome.delivered || outcome.disposition === 'skipped',
                    error: outcome.delivered ? undefined : outcome.disposition
                };
            });
            logger.info('Notification retries processed', { ...stats });
            return {
                success: true,
                message: 'Notification retries processed',
                processed: stats.processed,
                errors: stats.failed + stats.permanentlyFailed,
                durationMs: Date.now() - startedAt.getTime(),
                details: { ...stats }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Notification retry failed', { error: message });
            return {
                success: false,
                message,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime()
            };
        }
    }
};
