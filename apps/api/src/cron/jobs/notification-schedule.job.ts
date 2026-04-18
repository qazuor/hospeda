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

import { billingNotificationLog, eq, getDb, sql, withTransaction } from '@repo/db';
import { type NotificationPayload, NotificationType, RetryService } from '@repo/notifications';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { processDbNotificationRetries } from '../../services/notification-retry.service.js';
import { TrialService } from '../../services/trial.service.js';
import { loadBillingSettings } from '../../utils/billing-settings.js';
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
 * When daysAhead is provided, it is included in the key so that reminders for
 * different day windows (e.g. 3-day vs 1-day) are tracked independently.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param daysAhead - Optional day window to include in the key
 * @returns Idempotency key
 */
function generateIdempotencyKey(
    type: NotificationType,
    customerId: string,
    daysAhead?: number
): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const daySuffix = daysAhead !== undefined ? `:d${daysAhead}` : '';
    return `${type}:${customerId}:${today}${daySuffix}`;
}

/**
 * Check if notification was already sent today.
 * Uses Redis when available, falls back to in-memory Set.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param daysAhead - Optional day window for key differentiation
 * @returns Whether notification was already sent
 */
async function wasNotificationSent(
    type: NotificationType,
    customerId: string,
    daysAhead?: number
): Promise<boolean> {
    const key = generateIdempotencyKey(type, customerId, daysAhead);

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
 * @param daysAhead - Optional day window for key differentiation
 */
async function markNotificationSent(
    type: NotificationType,
    customerId: string,
    daysAhead?: number
): Promise<void> {
    const key = generateIdempotencyKey(type, customerId, daysAhead);

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
 * Discriminated union returned by the withTransaction callback in the cron handler.
 * Allows the outer handler to distinguish lock-skip from real execution results.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

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

        // Load settings from DB, falling back to compile-time constants
        const billingSettings = await loadBillingSettings();
        const trialReminderDays = billingSettings.trialExpiryReminderDays;

        let processed = 0;
        let errors = 0;

        // Purge stale entries (>25h) instead of clearing all.
        // This preserves idempotency between runs on the same day when Redis is unavailable.
        purgeStaleFallbackEntries();

        try {
            // Prevent overlapping cron executions via PostgreSQL advisory lock (GAP-034).
            // Lock key 1002 is reserved for this job. Uses pg_try_advisory_xact_lock
            // (transaction-level) instead of pg_try_advisory_lock (session-level) for
            // compatibility with Neon's transaction pooling (PgBouncer). Transaction-level
            // locks auto-release on commit/rollback — no manual unlock needed.
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(1002) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting notification schedule job', {
                    dryRun,
                    startedAt: startedAt.toISOString(),
                    trialReminderDays,
                    sendTrialExpiryReminder: billingSettings.sendTrialExpiryReminder,
                    settingsSource: 'database-with-fallback'
                });

                // Get billing instance
                const billing = getQZPayBilling();

                if (!billing) {
                    logger.warn('Billing not configured, skipping notification schedule');
                    return {
                        skipped: false,
                        success: true,
                        message: 'Skipped - Billing not configured',
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }

                // Create trial service
                const trialService = new TrialService(billing);

                // 1. Find trials ending within the configured reminder window
                logger.info('Finding trials ending soon', { daysAhead: trialReminderDays });
                const trialsEnding3Days = await trialService.findTrialsEndingSoon({
                    daysAhead: trialReminderDays
                });

                logger.info('Found trials ending soon', {
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
                            // Check idempotency (include daysAhead to differentiate 3-day vs 1-day)
                            if (
                                await wasNotificationSent(
                                    NotificationType.TRIAL_ENDING_REMINDER,
                                    trial.customerId,
                                    trialReminderDays
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (3 days)', {
                                    customerId: trial.customerId
                                });
                                continue;
                            }

                            const upgradeUrl = `${env.HOSPEDA_SITE_URL}/mi-cuenta/suscripcion`;

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
                                    trial.customerId,
                                    trialReminderDays
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
                                trial.customerId,
                                trialReminderDays
                            );
                            processed++;

                            logger.debug('Sent trial ending reminder (3 days)', {
                                customerId: trial.customerId,
                                daysRemaining: trialReminderDays
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
                            // Check idempotency (include daysAhead=1 to differentiate from multi-day reminder)
                            if (
                                await wasNotificationSent(
                                    NotificationType.TRIAL_ENDING_REMINDER,
                                    trial.customerId,
                                    1
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (1 day)', {
                                    customerId: trial.customerId
                                });
                                continue;
                            }

                            const upgradeUrl = `${env.HOSPEDA_SITE_URL}/mi-cuenta/suscripcion`;

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
                                    trial.customerId,
                                    1
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
                                trial.customerId,
                                1
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
                            // Use Math.max to guard against Math.ceil(0) returning 0 at exact midnight
                            const daysRemaining = Math.max(
                                Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
                                1
                            );
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
                            // Use Math.max to guard against Math.ceil(0) returning 0 at exact midnight
                            const daysRemaining = Math.max(
                                Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
                                1
                            );

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
                                            (p: {
                                                billingInterval?: string;
                                                unitAmount?: number;
                                            }) => p.billingInterval === subscription.interval
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
                                logger.warn(
                                    'Notification marked as permanently failed in database',
                                    {
                                        notificationId: notification.id
                                    }
                                );
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
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error)
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
                            error:
                                retryError instanceof Error
                                    ? retryError.message
                                    : String(retryError)
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
                    skipped: false,
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
                // End of withTransaction callback — lock auto-releases on commit
            });

            // Handle lock-not-acquired case from inside the transaction
            if (cronResult.skipped) {
                logger.warn(
                    'notification-schedule cron: skipping — previous run still holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped — another instance is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                ...(cronResult.details ? { details: cronResult.details } : {})
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
        // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
        // transaction commit/rollback. The lock was scoped to the withTransaction call above.
    }
};
