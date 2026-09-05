/**
 * Notification Schedule Cron Job
 *
 * Sends scheduled notifications for trials and subscriptions.
 * Runs daily at 8:00 UTC (5:00 AM Argentina time).
 *
 * Features:
 * - Runs the nine-send Hospeda-owned trial email series (HOS-1012 §4): three
 *   warnings at 10, 5 and 1 days before `trial_end`, the expiry mail on the day
 *   the listing comes down, and win-backs at +1, +5, +10, +30 and +60. The
 *   offsets are constants, not settings, and every send has its own template;
 *   the mechanics live in `trial-series-dispatch.ts`.
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 7 days
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 3 days
 * - Sends RENEWAL_REMINDER for subscriptions renewing in 1 day
 * - Processes failed notification retries from Redis queue
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 *
 * @module cron/jobs/notification-schedule
 */

import type { QZPayBilling, QZPaySubscription } from '@qazuor/qzpay-core';
import { billingNotificationLog, eq, getDb, sql, withTransaction } from '@repo/db';
import { type NotificationPayload, NotificationType, RetryService } from '@repo/notifications';
import { hydrateSubscriptionProductDomains, isAddonSubscription } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { planDisplayNameFromPlan } from '../../services/billing/plan-change-reason.js';
import { processDbNotificationRetries } from '../../services/notification-retry.service.js';
import { loadBillingSettings } from '../../utils/billing-settings.js';
import { lookupCustomerDetails } from '../../utils/customer-lookup.js';
import { sendNotification } from '../../utils/notification-helper.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobDefinition } from '../types.js';
import {
    evaluateRenewalReminder,
    RENEWAL_REMINDER_DAYS
} from './notification-schedule-renewal-window.js';
import { dispatchTrialSeries } from './trial-series-dispatch.js';

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
    const daySuffix = daysAhead === undefined ? '' : `:d${daysAhead}`;
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
 * Loads every `active` subscription via `billing.subscriptions.listAll`,
 * excluding a recurring add-on's own preapproval row (HOS-847).
 *
 * **Why this matters here specifically**: once an add-on preapproval row
 * reaches `active` (PR 5 of the HOS-847 chain), this sweep would otherwise
 * send it a "your subscription renews in N days" email. `subscription.planId`
 * for that row does not resolve via `billing.plans.get()` to a real
 * `billing_plans` row, so the email would read "your Unknown Plan renews" for
 * a ~$5.000 add-on. Worse: {@link wasNotificationSent} dedupes by
 * `customerId` alone (no `subscriptionId`), so that add-on notification could
 * consume the dedup slot for the SAME customer's real plan reminder in the
 * same window, silently swallowing the renewal notice for what they actually
 * pay for.
 *
 * **Hydration is required**: `listAll()` returns `QZPaySubscription` objects
 * built field-by-field by qzpay-core's mapper, which does not declare
 * `productDomain` (a Hospeda-only column beyond qzpay-core's interface) — so
 * every object arrives with it `undefined`, never the real string. See
 * {@link hydrateSubscriptionProductDomains}'s own doc for the full mechanism.
 *
 * @param billing - The QZPay billing facade (`getQZPayBilling()`).
 * @returns Every active subscription that is NOT an add-on's own preapproval.
 */
async function loadActiveNonAddonSubscriptions(
    billing: QZPayBilling
): Promise<QZPaySubscription[]> {
    const activeSubscriptions = await billing.subscriptions.listAll({
        filters: { status: 'active' }
    });
    const hydrated = await hydrateSubscriptionProductDomains(activeSubscriptions ?? []);
    return hydrated.filter((sub) => !isAddonSubscription(sub));
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

        // Load settings from DB, falling back to compile-time constants.
        // `trialExpiryReminderDays` is GONE (HOS-1012 T-016): the nine offsets
        // are constants in `trial-notification-offsets.ts` because each email's
        // copy names its own distance, so an admin able to move the distance is
        // an admin able to make the copy lie.
        const billingSettings = await loadBillingSettings();

        let processed = 0;
        let errors = 0;

        // Purge stale entries (>25h) instead of clearing all.
        // This preserves idempotency between runs on the same day when Redis is unavailable.
        purgeStaleFallbackEntries();

        try {
            // Prevent overlapping cron executions via PostgreSQL advisory lock (GAP-034).
            // Lock key 1002 is reserved for this job. Uses pg_try_advisory_xact_lock
            // (transaction-level) instead of pg_try_advisory_lock (session-level) so the
            // lock survives correctly under transaction-mode connection poolers
            // (PgBouncer, Coolify's pooled clients, etc.). Transaction-level locks
            // auto-release on commit/rollback — no manual unlock needed.
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(1002) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting notification schedule job', {
                    dryRun,
                    startedAt: startedAt.toISOString(),
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

                // 1. The nine-send Hospeda-owned trial series (HOS-1012 §4):
                // three warnings before `trial_end`, the expiry mail on the day
                // the listing comes down, and five win-backs after. Each send
                // has its own template and its own DURABLE dedup row in
                // `billing_subscription_events`, and every dispatch re-reads
                // live subscription state first — the series stops the moment
                // the person pays.
                //
                // `sendTrialExpiryReminder` gates the eight REMINDER sends and
                // NOT the expiry mail. That mail is TRANSACTIONAL: a host whose
                // listing left the site has to be told it left the site, and an
                // admin preference about reminders is not consent to withhold
                // that. Note the toggle was previously logged and never read,
                // so an admin who turned it off still got every reminder.
                const trialResult = await dispatchTrialSeries({
                    billing,
                    dryRun,
                    logger,
                    remindersEnabled: billingSettings.sendTrialExpiryReminder
                });
                processed += trialResult.sent;
                errors += trialResult.errors;

                // 3. Find subscriptions renewing soon (7, 3, and 1 day reminders)
                logger.info('Finding subscriptions renewing soon', {
                    reminderDays: RENEWAL_REMINDER_DAYS
                });

                let renewalsSent = 0;

                if (dryRun) {
                    // In dry run, still count what would be sent
                    try {
                        // `listAll` paginates: `list` would silently cap this at one
                        // page, and the reminder pass must see every active
                        // subscription. The status filter is applied by the storage
                        // layer as of qzpay-drizzle 2.0.0 — before that it was
                        // accepted and discarded (HOS-854). HOS-847: excludes a
                        // recurring add-on's own preapproval row — see
                        // loadActiveNonAddonSubscriptions's doc.
                        const activeSubscriptions = await loadActiveNonAddonSubscriptions(billing);

                        const now = new Date();
                        const reminderDaysSet = new Set(RENEWAL_REMINDER_DAYS);

                        const renewingSoon = (activeSubscriptions ?? []).filter(
                            (sub) =>
                                evaluateRenewalReminder({
                                    subscription: sub,
                                    now,
                                    reminderDays: reminderDaysSet
                                }).due
                        );

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
                        // See the dry-run branch above: `listAll` so the pass is not
                        // capped at one page, and the status filter is now honoured
                        // by storage rather than silently dropped. HOS-847: excludes
                        // a recurring add-on's own preapproval row.
                        const activeSubscriptions = await loadActiveNonAddonSubscriptions(billing);

                        const now = new Date();
                        const reminderDaysSet = new Set(RENEWAL_REMINDER_DAYS);

                        for (const subscription of activeSubscriptions ?? []) {
                            const verdict = evaluateRenewalReminder({
                                subscription,
                                now,
                                reminderDays: reminderDaysSet
                            });

                            if (!verdict.due) continue;

                            const { daysRemaining, renewalDate: endDate } = verdict;

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
                                        // HOS-231: `plan.name` is the SLUG; use the
                                        // display name (metadata.displayName) for the
                                        // customer-facing email — no extra query.
                                        planName = planDisplayNameFromPlan(plan);
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
                                    ...(amount === undefined ? {} : { amount, currency }),
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
                        // Per-offset cohort sizes plus every skip reason. A run
                        // that reports only what it sent cannot tell "nobody
                        // was due today" from "everything was skipped".
                        trialSeries: {
                            cohortSizes: trialResult.cohortSizes,
                            sent: trialResult.sent,
                            deduped: trialResult.deduped,
                            converted: trialResult.converted,
                            noCustomer: trialResult.noCustomer
                        },
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
