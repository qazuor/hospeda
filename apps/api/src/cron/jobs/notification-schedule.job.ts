/**
 * Notification Schedule Cron Job
 *
 * Sends scheduled notifications for trials and subscriptions.
 * Runs daily at 8:00 UTC (5:00 AM Argentina time).
 *
 * Features:
 * - Sends TRIAL_ENDING_REMINDER for trials ending in 3 days
 * - Sends TRIAL_ENDING_REMINDER for trials ending in 1 day
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 7 days
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 3 days
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 1 day
 * - Processes failed notification retries from Redis queue
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 *
 * @module cron/jobs/notification-schedule
 */

import { billingNotificationLog, eq, getDb } from '@repo/db';
import { type NotificationPayload, NotificationType, RetryService } from '@repo/notifications';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { processDbNotificationRetries } from '../../services/notification-retry.service.js';
import { TrialService } from '../../services/trial.service.js';
import { lookupCustomerDetails } from '../../utils/customer-lookup.js';
import { env } from '../../utils/env.js';
import { sendNotification } from '../../utils/notification-helper.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Days before renewal when reminders should be sent.
 * Sends at 7 days, 3 days, and 1 day before subscription renewal.
 */
const RENEWAL_REMINDER_DAYS: readonly number[] = [7, 3, 1] as const;

/**
 * In-memory fallback for idempotency keys when Redis is unavailable.
 * Maps key to timestamp (ms) of when the notification was sent.
 * Format: `${type}:${customerId}:${YYYY-MM-DD}` → timestamp
 */
const sentNotificationsFallback = new Map<string, number>();

/**
 * Reset the in-memory fallback. Intended for testing only.
 */
export function resetSentNotificationsFallback(): void {
    sentNotificationsFallback.clear();
}

/** Redis key prefix for notification idempotency */
const IDEMPOTENCY_KEY_PREFIX = 'notif:sent:';

/** TTL for idempotency keys in Redis (25 hours to cover timezone edge cases) */
const IDEMPOTENCY_TTL_SECONDS = 25 * 60 * 60;

/** TTL for in-memory fallback entries (25 hours, same as Redis) */
const FALLBACK_TTL_MS = 25 * 60 * 60 * 1000;

/**
 * Purge stale entries from the in-memory fallback that are older than 25h.
 * This preserves idempotency between runs on the same day while preventing
 * unbounded memory growth.
 */
function purgeStaleFallbackEntries(): void {
    const now = Date.now();
    for (const [key, timestamp] of sentNotificationsFallback) {
        if (now - timestamp > FALLBACK_TTL_MS) {
            sentNotificationsFallback.delete(key);
        }
    }
}

/**
 * Generate idempotency key for a notification.
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
 * Check if notification was already sent today.
 * Uses Redis when available, falls back to in-memory Set.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @returns Whether notification was already sent
 */
async function wasNotificationSent(type: NotificationType, customerId: string): Promise<boolean> {
    const key = generateIdempotencyKey(type, customerId);

    try {
        const redis = await getRedisClient();
        if (redis) {
            const exists = await redis.exists(`${IDEMPOTENCY_KEY_PREFIX}${key}`);
            return exists === 1;
        }
    } catch {
        // Fall through to in-memory check
    }

    return sentNotificationsFallback.has(key);
}

/**
 * Mark notification as sent.
 * Stores in Redis with TTL when available, otherwise in-memory Set.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 */
async function markNotificationSent(type: NotificationType, customerId: string): Promise<void> {
    const key = generateIdempotencyKey(type, customerId);

    try {
        const redis = await getRedisClient();
        if (redis) {
            await redis.set(`${IDEMPOTENCY_KEY_PREFIX}${key}`, '1', 'EX', IDEMPOTENCY_TTL_SECONDS);
            return;
        }
    } catch {
        // Fall through to in-memory storage
    }

    sentNotificationsFallback.set(key, Date.now());
}

/**
 * Notification schedule cron job definition
 *
 * Schedule: Daily at 8:00 UTC (5:00 AM Argentina time)
 * Purpose: Send scheduled notifications for trials and subscription renewals.
 *          Renewal reminders are sent at 7, 3, and 1 day(s) before the renewal date.
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

        // Purge stale entries (>25h) instead of clearing all.
        // This preserves idempotency between runs on the same day when Redis is unavailable.
        purgeStaleFallbackEntries();

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
                            await wasNotificationSent(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        ) {
                            logger.debug('Skipping duplicate notification (3 days)', {
                                customerId: trial.customerId
                            });
                            continue;
                        }

                        const upgradeUrl = `${env.HOSPEDA_SITE_URL || 'https://hospeda.com'}/mi-cuenta/suscripcion`;

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

                        await markNotificationSent(
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
                            await wasNotificationSent(
                                NotificationType.TRIAL_ENDING_REMINDER,
                                trial.customerId
                            )
                        ) {
                            logger.debug('Skipping duplicate notification (1 day)', {
                                customerId: trial.customerId
                            });
                            continue;
                        }

                        const upgradeUrl = `${env.HOSPEDA_SITE_URL || 'https://hospeda.com'}/mi-cuenta/suscripcion`;

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

                        await markNotificationSent(
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

            // 3. Find subscriptions renewing soon (7, 3, and 1 day reminders)
            logger.info('Finding subscriptions renewing soon', {
                reminderDays: RENEWAL_REMINDER_DAYS
            });

            let renewalsSent = 0;

            if (dryRun) {
                // In dry run, still count what would be sent
                try {
                    const activeSubscriptions = await billing.subscriptions.list({
                        filters: { status: 'active' }
                    });

                    const now = new Date();
                    const reminderDaysSet = new Set(RENEWAL_REMINDER_DAYS);

                    const renewingSoon = (activeSubscriptions?.data || []).filter((sub) => {
                        if (!sub.currentPeriodEnd) return false;
                        const endDate = new Date(sub.currentPeriodEnd);
                        const msRemaining = endDate.getTime() - now.getTime();
                        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
                        return reminderDaysSet.has(daysRemaining);
                    });

                    logger.info('Dry run mode - would send renewal reminders', {
                        count: renewingSoon.length
                    });
                    renewalsSent += renewingSoon.length;
                } catch (renewalError) {
                    logger.error('Failed to check renewal subscriptions (dry run)', {
                        error:
                            renewalError instanceof Error
                                ? renewalError.message
                                : String(renewalError)
                    });
                }
            } else {
                try {
                    const activeSubscriptions = await billing.subscriptions.list({
                        filters: { status: 'active' }
                    });

                    const now = new Date();
                    const reminderDaysSet = new Set(RENEWAL_REMINDER_DAYS);

                    for (const subscription of activeSubscriptions?.data || []) {
                        if (!subscription.currentPeriodEnd) continue;

                        const endDate = new Date(subscription.currentPeriodEnd);
                        const msRemaining = endDate.getTime() - now.getTime();
                        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

                        if (!reminderDaysSet.has(daysRemaining)) continue;

                        try {
                            // Check idempotency
                            if (
                                await wasNotificationSent(
                                    NotificationType.RENEWAL_REMINDER,
                                    subscription.customerId
                                )
                            ) {
                                logger.debug('Skipping duplicate renewal reminder', {
                                    customerId: subscription.customerId
                                });
                                continue;
                            }

                            // Look up customer details
                            const customerDetails = await lookupCustomerDetails(
                                billing,
                                subscription.customerId
                            );
                            if (!customerDetails) {
                                logger.warn('Could not look up customer for renewal reminder', {
                                    customerId: subscription.customerId
                                });
                                continue;
                            }

                            // Get plan name and price
                            let planName = 'Unknown Plan';
                            let amount: number | undefined;
                            const currency = 'ARS';
                            try {
                                const plan = await billing.plans.get(subscription.planId);
                                if (plan) {
                                    planName = plan.name;
                                    // Find price matching subscription interval
                                    const matchingPrice = plan.prices?.find(
                                        (p: { billingInterval?: string; unitAmount?: number }) =>
                                            p.billingInterval === subscription.interval
                                    );
                                    if (matchingPrice?.unitAmount) {
                                        amount = matchingPrice.unitAmount;
                                    }
                                }
                                if (amount === undefined) {
                                    logger.warn(
                                        'Could not determine plan price for renewal reminder',
                                        {
                                            customerId: subscription.customerId,
                                            planId: subscription.planId,
                                            interval: subscription.interval
                                        }
                                    );
                                }
                            } catch (planError) {
                                logger.error('Failed to fetch plan for renewal reminder', {
                                    customerId: subscription.customerId,
                                    planId: subscription.planId,
                                    error:
                                        planError instanceof Error
                                            ? planError.message
                                            : String(planError)
                                });
                                // amount stays undefined - will be omitted from notification
                            }

                            // Fire-and-forget notification
                            // Only include amount/currency if price was successfully resolved
                            sendNotification({
                                type: NotificationType.RENEWAL_REMINDER,
                                recipientEmail: customerDetails.email,
                                recipientName: customerDetails.name,
                                userId: customerDetails.userId,
                                customerId: subscription.customerId,
                                planName,
                                ...(amount !== undefined ? { amount, currency } : {}),
                                renewalDate: endDate.toISOString(),
                                daysRemaining,
                                idempotencyKey: generateIdempotencyKey(
                                    NotificationType.RENEWAL_REMINDER,
                                    subscription.customerId
                                )
                            }).catch((notifError) => {
                                logger.debug('Renewal reminder failed (will retry)', {
                                    customerId: subscription.customerId,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                });
                            });

                            await markNotificationSent(
                                NotificationType.RENEWAL_REMINDER,
                                subscription.customerId
                            );
                            renewalsSent++;
                            processed++;

                            logger.debug('Sent renewal reminder', {
                                customerId: subscription.customerId,
                                daysRemaining
                            });
                        } catch (error) {
                            errors++;
                            logger.error('Failed to send renewal reminder', {
                                customerId: subscription.customerId,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }

                    logger.info('Renewal reminders processed', { sent: renewalsSent });
                } catch (renewalError) {
                    logger.error('Failed to process renewal reminders', {
                        error:
                            renewalError instanceof Error
                                ? renewalError.message
                                : String(renewalError)
                    });
                }
            }

            // 4. Process notification retries
            // Try Redis-based retry first, fall back to database-based retry
            logger.info('Processing notification retries');

            let retriesProcessed = 0;
            let retriesSucceeded = 0;
            let retriesFailed = 0;
            let retriesPermanentlyFailed = 0;

            if (dryRun) {
                logger.info('Dry run mode - skipping notification retries');
            } else {
                try {
                    // First try Redis-based retry (if Redis is configured)
                    const redisClient = (await getRedisClient()) ?? null;
                    const retryService = new RetryService(redisClient, {
                        onPermanentFailure: async (notification) => {
                            const db = getDb();
                            await db
                                .update(billingNotificationLog)
                                .set({
                                    status: 'permanently_failed',
                                    errorMessage: notification.lastError
                                })
                                .where(eq(billingNotificationLog.id, notification.id));
                            logger.warn('Notification marked as permanently failed in database', {
                                notificationId: notification.id
                            });
                        }
                    });

                    if (redisClient) {
                        // Process Redis-based retries
                        const retryStats = await retryService.processRetries(
                            async (payload: unknown) => {
                                try {
                                    const notificationPayload = payload as NotificationPayload;
                                    await sendNotification(notificationPayload);
                                    return { success: true };
                                } catch (error) {
                                    return {
                                        success: false,
                                        error:
                                            error instanceof Error ? error.message : String(error)
                                    };
                                }
                            }
                        );

                        retriesProcessed = retryStats.processed;
                        retriesSucceeded = retryStats.succeeded;
                        retriesFailed = retryStats.failed;
                        retriesPermanentlyFailed = retryStats.permanentlyFailed;

                        logger.info('Redis-based notification retry complete', {
                            processed: retriesProcessed,
                            succeeded: retriesSucceeded,
                            failed: retriesFailed,
                            permanentlyFailed: retriesPermanentlyFailed
                        });
                    }

                    // Fall back to database-based retry for critical notifications
                    // This works even when Redis is not available
                    logger.info('Processing database-based notification retries (fallback)');

                    const dbRetryStats = await processDbNotificationRetries(dryRun);

                    // Combine stats
                    retriesProcessed += dbRetryStats.processed;
                    retriesSucceeded += dbRetryStats.succeeded;
                    retriesFailed += dbRetryStats.failed;
                    retriesPermanentlyFailed += dbRetryStats.permanentlyFailed;

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
                    renewalsSent,
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
