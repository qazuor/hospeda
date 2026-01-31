/**
 * Notification Schedule Cron Job
 *
 * Sends scheduled notifications for trials and subscriptions.
 * Runs daily at 8:00 UTC (5:00 AM Argentina time).
 *
 * Features:
 * - Sends TRIAL_ENDING_REMINDER for trials ending in 3 days
 * - Sends TRIAL_ENDING_REMINDER for trials ending in 1 day
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 3 days
 * - Processes failed notification retries from Redis queue
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 *
 * @module cron/jobs/notification-schedule
 */

import { type NotificationPayload, NotificationType, RetryService } from '@repo/notifications';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { TrialService } from '../../services/trial.service.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Set of sent notification idempotency keys to prevent duplicates within the same run
 * Format: `${type}:${customerId}:${YYYY-MM-DD}`
 */
const sentNotifications = new Set<string>();

/**
 * Generate idempotency key for a notification
 *
 * Ensures we don't send the same notification multiple times on the same day.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @returns Idempotency key
 */
function generateIdempotencyKey(type: NotificationType, customerId: string): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}:${customerId}:${today}`;
}

/**
 * Check if notification was already sent today
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @returns Whether notification was already sent
 */
function wasNotificationSent(type: NotificationType, customerId: string): boolean {
    const key = generateIdempotencyKey(type, customerId);
    return sentNotifications.has(key);
}

/**
 * Mark notification as sent
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 */
function markNotificationSent(type: NotificationType, customerId: string): void {
    const key = generateIdempotencyKey(type, customerId);
    sentNotifications.add(key);
}

/**
 * Notification schedule cron job definition
 *
 * Schedule: Daily at 8:00 UTC (5:00 AM Argentina time)
 * Purpose: Send scheduled notifications for trials and subscription renewals
 */
export const notificationScheduleJob: CronJobDefinition = {
    name: 'notification-schedule',
    description: 'Send scheduled notifications for trials and subscription renewals',
    schedule: '0 8 * * *', // Daily at 8:00 UTC
    enabled: true,
    timeoutMs: 120000, // 2 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting notification schedule job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let processed = 0;
        let errors = 0;

        // Clear sent notifications set at start of each run
        sentNotifications.clear();

        try {
            // Get billing instance
            const billing = getQZPayBilling();

            if (!billing) {
                logger.warn('Billing not configured, skipping notification schedule');
                return {
                    success: true,
                    message: 'Skipped - Billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // Create trial service
            const trialService = new TrialService(billing);

            // 1. Find trials ending in 3 days
            logger.info('Finding trials ending in 3 days');
            const trialsEnding3Days = await trialService.findTrialsEndingSoon({
                daysAhead: 3
            });

            logger.info('Found trials ending in 3 days', {
                count: trialsEnding3Days.length
            });

            if (dryRun) {
                logger.info('Dry run mode - would send trial ending (3 days) reminders', {
                    count: trialsEnding3Days.length
                });
                processed += trialsEnding3Days.length;
            } else {
                // Send TRIAL_ENDING_REMINDER for 3-day trials
                for (const trial of trialsEnding3Days) {
                    try {
                        // Check idempotency
                        if (
                            wasNotificationSent(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        ) {
                            logger.debug('Skipping duplicate notification (3 days)', {
                                customerId: trial.customerId
                            });
                            continue;
                        }

                        const upgradeUrl = `${process.env.WEB_URL || 'https://hospeda.com'}/mi-cuenta/suscripcion`;

                        // Fire-and-forget notification
                        sendNotification({
                            type: NotificationType.TRIAL_ENDING_REMINDER,
                            recipientEmail: trial.userEmail,
                            recipientName: trial.userName,
                            userId: trial.userId,
                            customerId: trial.customerId,
                            planName: trial.planSlug,
                            trialEndDate: trial.trialEnd.toISOString(),
                            daysRemaining: trial.daysRemaining,
                            upgradeUrl,
                            idempotencyKey: generateIdempotencyKey(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        }).catch((notifError) => {
                            logger.debug('Trial ending notification failed (will retry)', {
                                customerId: trial.customerId,
                                error:
                                    notifError instanceof Error
                                        ? notifError.message
                                        : String(notifError)
                            });
                        });

                        markNotificationSent(
                            NotificationType.TRIAL_ENDING_REMINDER,
                            trial.customerId
                        );
                        processed++;

                        logger.debug('Sent trial ending reminder (3 days)', {
                            customerId: trial.customerId,
                            daysRemaining: 3
                        });
                    } catch (error) {
                        errors++;
                        logger.error('Failed to send trial ending notification (3 days)', {
                            customerId: trial.customerId,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }

            // 2. Find trials ending in 1 day
            logger.info('Finding trials ending in 1 day');
            const trialsEnding1Day = await trialService.findTrialsEndingSoon({
                daysAhead: 1
            });

            logger.info('Found trials ending in 1 day', {
                count: trialsEnding1Day.length
            });

            if (dryRun) {
                logger.info('Dry run mode - would send trial ending (1 day) reminders', {
                    count: trialsEnding1Day.length
                });
                processed += trialsEnding1Day.length;
            } else {
                // Send TRIAL_ENDING_REMINDER for 1-day trials
                for (const trial of trialsEnding1Day) {
                    try {
                        // Check idempotency
                        if (
                            wasNotificationSent(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        ) {
                            logger.debug('Skipping duplicate notification (1 day)', {
                                customerId: trial.customerId
                            });
                            continue;
                        }

                        const upgradeUrl = `${process.env.WEB_URL || 'https://hospeda.com'}/mi-cuenta/suscripcion`;

                        // Fire-and-forget notification
                        sendNotification({
                            type: NotificationType.TRIAL_ENDING_REMINDER,
                            recipientEmail: trial.userEmail,
                            recipientName: trial.userName,
                            userId: trial.userId,
                            customerId: trial.customerId,
                            planName: trial.planSlug,
                            trialEndDate: trial.trialEnd.toISOString(),
                            daysRemaining: trial.daysRemaining,
                            upgradeUrl,
                            idempotencyKey: generateIdempotencyKey(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        }).catch((notifError) => {
                            logger.debug('Trial ending notification failed (will retry)', {
                                customerId: trial.customerId,
                                error:
                                    notifError instanceof Error
                                        ? notifError.message
                                        : String(notifError)
                            });
                        });

                        markNotificationSent(
                            NotificationType.TRIAL_ENDING_REMINDER,
                            trial.customerId
                        );
                        processed++;

                        logger.debug('Sent trial ending reminder (1 day)', {
                            customerId: trial.customerId,
                            daysRemaining: 1
                        });
                    } catch (error) {
                        errors++;
                        logger.error('Failed to send trial ending notification (1 day)', {
                            customerId: trial.customerId,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }

            // 3. Find subscriptions renewing in 3 days
            logger.info('Finding subscriptions renewing in 3 days');

            if (dryRun) {
                logger.info('Dry run mode - skipping renewal reminders (not implemented yet)');
            } else {
                // TODO: Implement subscription renewal reminders
                // This requires:
                // 1. SubscriptionService.findSubscriptionsRenewingSoon(daysAhead: 3)
                // 2. Send RENEWAL_REMINDER notifications
                // 3. Track sent notifications with idempotency keys

                logger.debug('Subscription renewal reminders not implemented yet');
            }

            // 4. Process notification retries from Redis queue
            logger.info('Processing notification retries');

            let retriesProcessed = 0;
            let retriesSucceeded = 0;
            let retriesFailed = 0;
            let retriesPermanentlyFailed = 0;

            if (dryRun) {
                logger.info('Dry run mode - skipping notification retries');
            } else {
                try {
                    // Create retry service (will handle null Redis gracefully)
                    // TODO: When Redis is configured, pass actual Redis client here
                    const retryService = new RetryService(null);

                    // Process retries using sendNotification helper
                    const retryStats = await retryService.processRetries(
                        async (payload: unknown) => {
                            try {
                                // Cast payload to NotificationPayload type
                                const notificationPayload = payload as NotificationPayload;

                                // Send notification (fire-and-forget, but we await for retry tracking)
                                await sendNotification(notificationPayload);

                                // Return success (sendNotification doesn't throw on failure)
                                return { success: true };
                            } catch (error) {
                                // Return failure with error message
                                return {
                                    success: false,
                                    error: error instanceof Error ? error.message : String(error)
                                };
                            }
                        }
                    );

                    retriesProcessed = retryStats.processed;
                    retriesSucceeded = retryStats.succeeded;
                    retriesFailed = retryStats.failed;
                    retriesPermanentlyFailed = retryStats.permanentlyFailed;

                    logger.info('Notification retry processing complete', {
                        processed: retriesProcessed,
                        succeeded: retriesSucceeded,
                        failed: retriesFailed,
                        permanentlyFailed: retriesPermanentlyFailed
                    });
                } catch (retryError) {
                    // Don't fail the entire job if retry processing fails
                    logger.error('Failed to process notification retries', {
                        error: retryError instanceof Error ? retryError.message : String(retryError)
                    });
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Notification schedule job completed', {
                processed,
                errors,
                durationMs,
                retries: {
                    processed: retriesProcessed,
                    succeeded: retriesSucceeded,
                    failed: retriesFailed,
                    permanentlyFailed: retriesPermanentlyFailed
                }
            });

            return {
                success: true,
                message: `Processed ${processed} scheduled notifications (${errors} errors), ${retriesProcessed} retries (${retriesSucceeded} succeeded, ${retriesFailed} re-queued, ${retriesPermanentlyFailed} permanently failed)`,
                processed,
                errors,
                durationMs,
                details: {
                    trialsEnding3Days: trialsEnding3Days.length,
                    trialsEnding1Day: trialsEnding1Day.length,
                    retries: {
                        processed: retriesProcessed,
                        succeeded: retriesSucceeded,
                        failed: retriesFailed,
                        permanentlyFailed: retriesPermanentlyFailed
                    },
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('Notification schedule job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to process scheduled notifications: ${errorMessage}`,
                processed,
                errors,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        }
    }
};
