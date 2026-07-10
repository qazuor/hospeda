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

import {
    and,
    billingNotificationLog,
    billingSubscriptionEvents,
    eq,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import { type NotificationPayload, NotificationType, RetryService } from '@repo/notifications';
import { BILLING_EVENT_TYPES, type TrialEndingSubscription } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { processDbNotificationRetries } from '../../services/notification-retry.service.js';
import { buildTrialUpgradeUrl, TrialService } from '../../services/trial.service.js';
import { loadBillingSettings } from '../../utils/billing-settings.js';
import { lookupCustomerDetails } from '../../utils/customer-lookup.js';
import { env } from '../../utils/env.js';
import { sendNotification } from '../../utils/notification-helper.js';
import { getRedisClient } from '../../utils/redis.js';
import type { CronJobContext, CronJobDefinition } from '../types.js';

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

/** `trigger_source` recorded on the durable trial-reminder dedup rows. */
const TRIAL_DEDUP_TRIGGER_SOURCE = 'cron';

/**
 * Map a trial-reminder variant to its durable dedup event type.
 *
 * - `D3` — the primary "your trial ends soon" reminder (skip-tolerant window).
 * - `D1` — the "your trial ends tomorrow" urgency reminder (exact day-1 match).
 *
 * Reuses the pre-existing `TRIAL_PRE_END_NOTIF_D3/_D1` event types (HOS-121
 * NG-4): audit rows already written on staging/prod reference these strings, so
 * a matching subscription is idempotently treated as "already sent".
 */
function trialVariantToEventType(variant: 'D3' | 'D1'): string {
    return variant === 'D3'
        ? BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3
        : BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D1;
}

/**
 * Send a single trial-ending reminder guarded by a DURABLE per-variant dedup
 * ledger (`billing_subscription_events`).
 *
 * Unlike the Redis-TTL + in-memory Map dedup used for renewals, a permanent
 * event row survives process restarts and multi-replica races (HOS-121 §4.2).
 * Being per-variant, the skip-tolerant primary window and the exact day-1
 * reminder can never double-send the same variant (HOS-121 §4.3 — the wider
 * window is only safe because of this durable dedup).
 *
 * The dedup select + insert run on the AUTOCOMMIT connection (`getDb()`), NOT on
 * the job's umbrella advisory-lock transaction: the row must persist the instant
 * the email is dispatched, so a later rollback of the (long-running, external-IO)
 * renewal/retry phases cannot strip an already-sent reminder's dedup row and
 * cause the whole batch to be re-sent next run. This mirrors how the renewal
 * branch marks Redis out-of-band. Concurrency across replicas is still serialized
 * by advisory lock 1002 (held by the outer transaction), and a partial UNIQUE
 * index on `(subscription_id, event_type)` for the trial variants backs the
 * `onConflictDoNothing()` insert as an atomic safety net.
 *
 * The send is fire-and-forget (matching the renewal branch); delivery failures
 * are handled by the notification-retry pipeline.
 *
 * @returns `'sent'` when a new reminder was dispatched, `'deduped'` when a prior
 *          row already recorded this variant for the subscription.
 */
async function sendTrialReminderDurable(params: {
    readonly trial: TrialEndingSubscription;
    readonly variant: 'D3' | 'D1';
    readonly logger: CronJobContext['logger'];
}): Promise<'sent' | 'deduped'> {
    const { trial, variant, logger } = params;
    const db = getDb();
    const eventType = trialVariantToEventType(variant);

    const existing = await db
        .select({ id: billingSubscriptionEvents.id })
        .from(billingSubscriptionEvents)
        .where(
            and(
                eq(billingSubscriptionEvents.subscriptionId, trial.id),
                eq(billingSubscriptionEvents.eventType, eventType)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        return 'deduped';
    }

    // HOS-115 §5 nudge — target the owner pricing page and carry the interval
    // the customer originally chose (single source of truth in
    // `buildTrialUpgradeUrl`). This is the CORRECT url; the deleted
    // trial-pre-end-notif cron's `/cuenta/planes` + `userId: null` url is NOT
    // ported (HOS-121 NG-1).
    const upgradeUrl = buildTrialUpgradeUrl({
        siteUrl: env.HOSPEDA_SITE_URL,
        intendedInterval: trial.intendedInterval
    });

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
        idempotencyKey: `trial-ending-${variant.toLowerCase()}-${trial.id}`
    }).catch((notifError) => {
        logger.debug('Trial ending notification failed (will retry)', {
            customerId: trial.customerId,
            error: notifError instanceof Error ? notifError.message : String(notifError)
        });
    });

    // onConflictDoNothing: atomic backstop against the check-then-act race if a
    // second writer ever slips past the SELECT (impossible under lock 1002 today,
    // but keeps the ledger consistent regardless). Relies on the partial UNIQUE
    // index from migrations/extras (HOS-121).
    await db
        .insert(billingSubscriptionEvents)
        .values({
            subscriptionId: trial.id,
            eventType,
            triggerSource: TRIAL_DEDUP_TRIGGER_SOURCE,
            metadata: {
                variant,
                daysRemaining: trial.daysRemaining,
                trialEnd: trial.trialEnd.toISOString(),
                sentAt: new Date().toISOString()
            }
        })
        .onConflictDoNothing();

    return 'sent';
}

/**
 * Process the trial-ending reminders: a skip-tolerant, config-aware primary
 * window plus the exact day-1 reminder, both backed by the durable dedup above.
 *
 * Primary window (HOS-121 §4.1): covers `[trialReminderDays-1, trialReminderDays]`
 * so a single skipped cron day does not drop the primary reminder. Values below
 * 2 are excluded so the primary window never overlaps the exact day-1 reminder.
 * Because `findTrialsEndingSoon` matches an exact day (its contract is shared
 * and left unchanged — HOS-121 OQ-3), the window is assembled by querying each
 * day in the tolerance range and de-duplicating by subscription id.
 *
 * @returns per-run counters; `processed` counts only newly-sent reminders
 *          (deduped ones are not counted), `errors` counts send/DB failures.
 */
async function processTrialReminders(params: {
    readonly trialService: TrialService;
    readonly trialReminderDays: number;
    readonly dryRun: boolean;
    readonly logger: CronJobContext['logger'];
}): Promise<{
    processed: number;
    errors: number;
    primaryCount: number;
    oneDayCount: number;
}> {
    const { trialService, trialReminderDays, dryRun, logger } = params;

    const primaryDaysAhead = Array.from(new Set([trialReminderDays, trialReminderDays - 1])).filter(
        (days) => days >= 2
    );

    // Assemble the primary window, de-duplicating by subscription id so a trial
    // straddling two adjacent days in the tolerance range is processed once.
    const primaryById = new Map<string, TrialEndingSubscription>();
    for (const daysAhead of primaryDaysAhead) {
        const found = await trialService.findTrialsEndingSoon({ daysAhead });
        for (const trial of found) {
            if (!primaryById.has(trial.id)) {
                primaryById.set(trial.id, trial);
            }
        }
    }
    const primaryTrials = [...primaryById.values()];

    const oneDayTrials = await trialService.findTrialsEndingSoon({ daysAhead: 1 });

    logger.info('Found trials ending soon', {
        primaryWindow: primaryDaysAhead,
        primaryCount: primaryTrials.length,
        oneDayCount: oneDayTrials.length
    });

    if (dryRun) {
        logger.info('Dry run mode - would send trial ending reminders', {
            primaryCount: primaryTrials.length,
            oneDayCount: oneDayTrials.length
        });
        return {
            processed: primaryTrials.length + oneDayTrials.length,
            errors: 0,
            primaryCount: primaryTrials.length,
            oneDayCount: oneDayTrials.length
        };
    }

    let processed = 0;
    let errors = 0;

    const batches: ReadonlyArray<{
        readonly trials: readonly TrialEndingSubscription[];
        readonly variant: 'D3' | 'D1';
    }> = [
        { trials: primaryTrials, variant: 'D3' },
        { trials: oneDayTrials, variant: 'D1' }
    ];

    for (const { trials, variant } of batches) {
        for (const trial of trials) {
            try {
                const outcome = await sendTrialReminderDurable({ trial, variant, logger });
                if (outcome === 'sent') {
                    processed++;
                    logger.debug('Sent trial ending reminder', {
                        customerId: trial.customerId,
                        subscriptionId: trial.id,
                        variant,
                        daysRemaining: trial.daysRemaining
                    });
                } else {
                    logger.debug('Skipping duplicate trial reminder (durable dedup)', {
                        customerId: trial.customerId,
                        subscriptionId: trial.id,
                        variant
                    });
                }
            } catch (error) {
                errors++;
                logger.error('Failed to send trial ending notification', {
                    customerId: trial.customerId,
                    subscriptionId: trial.id,
                    variant,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    return {
        processed,
        errors,
        primaryCount: primaryTrials.length,
        oneDayCount: oneDayTrials.length
    };
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

                // 1-2. Trial-ending reminders: a skip-tolerant, config-aware
                // primary window plus the exact day-1 reminder, both backed by
                // the DURABLE per-variant dedup ledger (billing_subscription_events)
                // instead of the Redis-TTL + in-memory Map used for renewals.
                // Ported from the now-deleted trial-pre-end-notif cron (HOS-121).
                const trialResult = await processTrialReminders({
                    trialService,
                    trialReminderDays,
                    dryRun,
                    logger
                });
                processed += trialResult.processed;
                errors += trialResult.errors;

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
                        trialsEndingPrimary: trialResult.primaryCount,
                        trialsEnding1Day: trialResult.oneDayCount,
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
