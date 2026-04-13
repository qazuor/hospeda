/**
 * Add-on Expiry Cron Job
 *
 * Processes expired add-ons and sends expiration warnings.
 * Runs daily at 5:00 UTC (2:00 AM Argentina time).
 *
 * Features:
 * - Finds and expires add-ons that have passed their expiration date
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 3 days
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 1 day
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 * - Processes in batches of 100 to avoid memory issues
 * - Revocation retry phase for orphaned active add-ons linked to cancelled subscriptions
 *
 * @module cron/jobs/addon-expiry
 */

import { getAddonBySlug } from '@repo/billing';
import {
    and,
    billingAddonPurchases,
    billingNotificationLog,
    billingSubscriptions,
    eq,
    getDb,
    isNull
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import * as Sentry from '@sentry/node';
import { sql } from 'drizzle-orm';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { AddonEntitlementService } from '../../services/addon-entitlement.service.js';
import { AddonExpirationService } from '../../services/addon-expiration.service.js';
import { revokeAddonForSubscriptionCancellation } from '../../services/addon-lifecycle.service.js';
import { lookupCustomerDetails } from '../../utils/customer-lookup.js';
import { apiLogger } from '../../utils/logger.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Generate idempotency key for an add-on notification.
 *
 * Ensures we don't send the same notification multiple times on the same day.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug
 * @returns Idempotency key
 */
function generateIdempotencyKey(
    type: NotificationType,
    customerId: string,
    addonSlug: string
): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}:${customerId}:${addonSlug}:${today}`;
}

/**
 * Check if notification was already sent today by querying the billing_notification_log table.
 * This persists idempotency across cron runs (unlike an in-memory Set).
 *
 * Matches on the exact idempotency key stored in `metadata->>'idempotencyKey'`, which
 * encodes `type`, `customerId`, `addonSlug`, and the current date. This ensures that
 * each (customer, addon) pair is tracked independently, preventing a notification for
 * one addon from suppressing legitimate notifications for a different addon belonging
 * to the same customer.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug (included in idempotency key)
 * @returns Whether notification was already sent today for this specific addon
 */
async function wasNotificationSent(
    type: NotificationType,
    customerId: string,
    addonSlug: string
): Promise<boolean> {
    try {
        const db = getDb();
        const idempotencyKey = generateIdempotencyKey(type, customerId, addonSlug);

        const existing = await db
            .select({ id: billingNotificationLog.id })
            .from(billingNotificationLog)
            .where(
                and(
                    eq(billingNotificationLog.type, type),
                    eq(billingNotificationLog.customerId, customerId),
                    eq(
                        sql<string>`${billingNotificationLog.metadata}->>'idempotencyKey'`,
                        idempotencyKey
                    )
                )
            )
            .limit(1);

        return existing.length > 0;
    } catch (error) {
        apiLogger.warn(
            {
                type,
                customerId,
                addonSlug,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to check notification log, allowing send to avoid missing notifications'
        );
        return false;
    }
}

/**
 * Maximum number of split-state subscriptions to reconcile per cron run.
 * Kept low to avoid timeout in the 2-minute cron window.
 */
const SPLIT_STATE_BATCH_SIZE = 10;

/**
 * Add-on expiry cron job definition
 *
 * Schedule: Daily at 5:00 UTC (2:00 AM Argentina time)
 * Purpose: Process expired add-ons and send expiration warnings
 */
export const addonExpiryJob: CronJobDefinition = {
    name: 'addon-expiry',
    description: 'Process expired add-ons and send expiration warnings',
    schedule: '0 5 * * *', // Daily at 5:00 UTC
    enabled: true,
    timeoutMs: 120000, // 2 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting add-on expiry job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        // Prevent overlapping cron executions via PostgreSQL advisory lock (GAP-043-10).
        // Lock key 43001 is reserved for this job. If a previous run is still active,
        // pg_try_advisory_lock returns false and we skip this execution immediately.
        const lockDb = getDb();
        const lockResult = await lockDb.execute(
            sql`SELECT pg_try_advisory_lock(43001) as acquired`
        );
        const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)?.acquired;

        if (!acquired) {
            apiLogger.warn('addon-expiry cron: skipping — previous run still holds advisory lock');
            return {
                success: true,
                message: 'Skipped: previous run still active (advisory lock not acquired)',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { skipped: true, reason: 'lock_not_acquired' }
            };
        }

        let processed = 0;
        let errors = 0;
        let warningsSent = 0;

        // Idempotency is now handled via billing_notification_log DB lookups
        // instead of an in-memory Set, so state persists across cron runs.

        try {
            // Ensure billing is initialized before proceeding
            const billing = getQZPayBilling();
            if (!billing) {
                apiLogger.error('QZPay billing not initialized, skipping addon expiry job');
                return {
                    success: false,
                    message: 'QZPay billing not initialized, skipping addon expiry job',
                    processed: 0,
                    errors: 1,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { error: 'billing_not_initialized' }
                };
            }

            // Create add-on expiration service with billing instance
            const addonExpirationService = new AddonExpirationService(billing);

            // 1. Process expired add-ons
            logger.info('Processing expired add-ons');

            // TODO(GAP-038-42): Sequential processing at scale may hit the 2-minute cron timeout
            // if the expired batch grows large (>100 items per run). Consider parallel processing
            // with Promise.allSettled() or increasing timeoutMs, but only after profiling real load.

            if (dryRun) {
                // Dry run mode - find what would be expired
                const expiredResult = await addonExpirationService.findExpiredAddons();

                if (expiredResult.success) {
                    const expiredCount = expiredResult.data?.length || 0;
                    logger.info('Dry run mode - would expire add-ons', {
                        count: expiredCount
                    });
                    processed += expiredCount;
                } else {
                    logger.error('Failed to find expired add-ons', {
                        error: expiredResult.error
                    });
                    errors++;
                }
            } else {
                // Production mode - find expired add-ons first (needed for post-expiry notifications)
                const findBeforeExpiry = await addonExpirationService.findExpiredAddons();
                const addonsToExpire = findBeforeExpiry.success
                    ? (findBeforeExpiry.data ?? [])
                    : [];

                // Actually expire add-ons
                const processResult = await addonExpirationService.processExpiredAddons();

                if (processResult.success) {
                    const result = processResult.data;
                    if (result) {
                        processed += result.processed;
                        errors += result.failed;

                        logger.info('Processed expired add-ons', {
                            processed: result.processed,
                            failed: result.failed,
                            errorsDetails: result.errors
                        });

                        // Build set of purchase IDs that failed so we skip their notifications
                        const failedPurchaseIds = new Set(
                            result.errors.map((e: { purchaseId: string }) => e.purchaseId)
                        );

                        // Send ADDON_EXPIRED notification for each successfully expired add-on
                        for (const expiredAddon of addonsToExpire) {
                            if (failedPurchaseIds.has(expiredAddon.id)) {
                                continue;
                            }

                            try {
                                // Check idempotency via DB lookup (persists across cron runs)
                                if (
                                    await wasNotificationSent(
                                        NotificationType.ADDON_EXPIRED,
                                        expiredAddon.customerId,
                                        expiredAddon.addonSlug
                                    )
                                ) {
                                    logger.debug('Skipping duplicate ADDON_EXPIRED notification', {
                                        customerId: expiredAddon.customerId,
                                        addonSlug: expiredAddon.addonSlug
                                    });
                                    continue;
                                }

                                // Look up customer details for notification.
                                // Reuse the billing instance already retrieved at job startup
                                // to avoid redundant getQZPayBilling() calls inside the loop.
                                const customerDetails = await lookupCustomerDetails(
                                    billing,
                                    expiredAddon.customerId
                                );
                                if (!customerDetails) {
                                    logger.warn(
                                        'Could not look up customer details, skipping ADDON_EXPIRED notification',
                                        {
                                            customerId: expiredAddon.customerId,
                                            addonSlug: expiredAddon.addonSlug
                                        }
                                    );
                                    continue;
                                }

                                // Resolve human-readable display name from config; fall back to slug
                                const addonConfigExpired = getAddonBySlug(expiredAddon.addonSlug);
                                const addonDisplayNameExpired =
                                    addonConfigExpired?.name ?? expiredAddon.addonSlug;

                                // Fire-and-forget notification (the notification helper logs to billing_notification_log)
                                sendNotification({
                                    type: NotificationType.ADDON_EXPIRED,
                                    recipientEmail: customerDetails.email,
                                    recipientName: customerDetails.name,
                                    userId: customerDetails.userId,
                                    customerId: expiredAddon.customerId,
                                    addonName: addonDisplayNameExpired,
                                    expirationDate: expiredAddon.expiresAt.toISOString(),
                                    idempotencyKey: generateIdempotencyKey(
                                        NotificationType.ADDON_EXPIRED,
                                        expiredAddon.customerId,
                                        expiredAddon.addonSlug
                                    )
                                }).catch((notifError) => {
                                    logger.warn('Add-on expired notification failed', {
                                        customerId: expiredAddon.customerId,
                                        addonSlug: expiredAddon.addonSlug,
                                        error:
                                            notifError instanceof Error
                                                ? notifError.message
                                                : String(notifError)
                                    });
                                });

                                logger.debug('Sent ADDON_EXPIRED notification', {
                                    customerId: expiredAddon.customerId,
                                    addonSlug: expiredAddon.addonSlug
                                });
                            } catch (notifLoopError) {
                                errors++;
                                Sentry.captureException(notifLoopError, {
                                    tags: {
                                        cronJob: 'addon-expiry',
                                        phase: 'expired-notification'
                                    },
                                    extra: {
                                        customerId: expiredAddon.customerId,
                                        addonSlug: expiredAddon.addonSlug
                                    }
                                });
                                logger.error('Failed to send ADDON_EXPIRED notification', {
                                    customerId: expiredAddon.customerId,
                                    addonSlug: expiredAddon.addonSlug,
                                    error:
                                        notifLoopError instanceof Error
                                            ? notifLoopError.message
                                            : String(notifLoopError)
                                });
                            }
                        }
                    }
                } else {
                    logger.error('Failed to process expired add-ons', {
                        error: processResult.error
                    });
                    errors++;
                }
            }

            // 2. Find add-ons expiring in 3 days and send warnings
            logger.info('Finding add-ons expiring in 3 days');
            const expiring3DaysResult = await addonExpirationService.findExpiringAddons({
                daysAhead: 3
            });

            if (expiring3DaysResult.success) {
                const expiring3Days = expiring3DaysResult.data || [];

                logger.info('Found add-ons expiring in 3 days', {
                    count: expiring3Days.length
                });

                if (dryRun) {
                    logger.info('Dry run mode - would send expiration warnings (3 days)', {
                        count: expiring3Days.length
                    });
                    warningsSent += expiring3Days.length;
                } else {
                    // Send ADDON_EXPIRATION_WARNING for 3-day add-ons
                    for (const expiringAddon of expiring3Days) {
                        try {
                            // Check idempotency via DB lookup (persists across cron runs)
                            if (
                                await wasNotificationSent(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    expiringAddon.customerId,
                                    expiringAddon.addonSlug
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (3 days)', {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug
                                });
                                continue;
                            }

                            // Look up customer details for notification.
                            // Reuse the billing instance already retrieved at job startup
                            // to avoid redundant getQZPayBilling() calls inside the loop.
                            const customerDetails = await lookupCustomerDetails(
                                billing,
                                expiringAddon.customerId
                            );
                            if (!customerDetails) {
                                logger.warn(
                                    'Could not look up customer details, skipping notification',
                                    {
                                        customerId: expiringAddon.customerId,
                                        addonSlug: expiringAddon.addonSlug
                                    }
                                );
                                continue;
                            }

                            // Resolve human-readable display name from config; fall back to slug
                            const addonConfig3d = getAddonBySlug(expiringAddon.addonSlug);
                            const addonDisplayName3d =
                                addonConfig3d?.name ?? expiringAddon.addonSlug;

                            // Fire-and-forget notification (the notification helper logs to billing_notification_log)
                            sendNotification({
                                type: NotificationType.ADDON_EXPIRATION_WARNING,
                                recipientEmail: customerDetails.email,
                                recipientName: customerDetails.name,
                                userId: customerDetails.userId,
                                customerId: expiringAddon.customerId,
                                addonName: addonDisplayName3d,
                                expirationDate: expiringAddon.expiresAt.toISOString(),
                                daysRemaining: expiringAddon.daysUntilExpiration,
                                idempotencyKey: generateIdempotencyKey(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    expiringAddon.customerId,
                                    expiringAddon.addonSlug
                                )
                            }).catch((notifError) => {
                                logger.warn('Add-on expiration warning failed (will retry)', {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                });
                            });

                            warningsSent++;

                            logger.debug('Sent add-on expiration warning (3 days)', {
                                customerId: expiringAddon.customerId,
                                addonSlug: expiringAddon.addonSlug,
                                daysRemaining: 3
                            });
                        } catch (error) {
                            errors++;
                            Sentry.captureException(error, {
                                tags: { cronJob: 'addon-expiry', phase: 'warning-3-days' },
                                extra: {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug
                                }
                            });
                            logger.error('Failed to send add-on expiration warning (3 days)', {
                                customerId: expiringAddon.customerId,
                                addonSlug: expiringAddon.addonSlug,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }
            } else {
                logger.error('Failed to find add-ons expiring in 3 days', {
                    error: expiring3DaysResult.error
                });
                errors++;
            }

            // 3. Find add-ons expiring in 1 day and send warnings
            logger.info('Finding add-ons expiring in 1 day');
            const expiring1DayResult = await addonExpirationService.findExpiringAddons({
                daysAhead: 1
            });

            if (expiring1DayResult.success) {
                const expiring1Day = expiring1DayResult.data || [];

                logger.info('Found add-ons expiring in 1 day', {
                    count: expiring1Day.length
                });

                if (dryRun) {
                    logger.info('Dry run mode - would send expiration warnings (1 day)', {
                        count: expiring1Day.length
                    });
                    warningsSent += expiring1Day.length;
                } else {
                    // Send ADDON_EXPIRATION_WARNING for 1-day add-ons
                    for (const expiringAddon of expiring1Day) {
                        try {
                            // Check idempotency via DB lookup (persists across cron runs)
                            if (
                                await wasNotificationSent(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    expiringAddon.customerId,
                                    expiringAddon.addonSlug
                                )
                            ) {
                                logger.debug('Skipping duplicate notification (1 day)', {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug
                                });
                                continue;
                            }

                            // Look up customer details for notification.
                            // Reuse the billing instance already retrieved at job startup
                            // to avoid redundant getQZPayBilling() calls inside the loop.
                            const customerDetails = await lookupCustomerDetails(
                                billing,
                                expiringAddon.customerId
                            );
                            if (!customerDetails) {
                                logger.warn(
                                    'Could not look up customer details, skipping notification',
                                    {
                                        customerId: expiringAddon.customerId,
                                        addonSlug: expiringAddon.addonSlug
                                    }
                                );
                                continue;
                            }

                            // Resolve human-readable display name from config; fall back to slug
                            const addonConfig1d = getAddonBySlug(expiringAddon.addonSlug);
                            const addonDisplayName1d =
                                addonConfig1d?.name ?? expiringAddon.addonSlug;

                            // Fire-and-forget notification (the notification helper logs to billing_notification_log)
                            sendNotification({
                                type: NotificationType.ADDON_EXPIRATION_WARNING,
                                recipientEmail: customerDetails.email,
                                recipientName: customerDetails.name,
                                userId: customerDetails.userId,
                                customerId: expiringAddon.customerId,
                                addonName: addonDisplayName1d,
                                expirationDate: expiringAddon.expiresAt.toISOString(),
                                daysRemaining: expiringAddon.daysUntilExpiration,
                                idempotencyKey: generateIdempotencyKey(
                                    NotificationType.ADDON_EXPIRATION_WARNING,
                                    expiringAddon.customerId,
                                    expiringAddon.addonSlug
                                )
                            }).catch((notifError) => {
                                logger.warn('Add-on expiration warning failed (will retry)', {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                });
                            });

                            warningsSent++;

                            logger.debug('Sent add-on expiration warning (1 day)', {
                                customerId: expiringAddon.customerId,
                                addonSlug: expiringAddon.addonSlug,
                                daysRemaining: 1
                            });
                        } catch (error) {
                            errors++;
                            Sentry.captureException(error, {
                                tags: { cronJob: 'addon-expiry', phase: 'warning-1-day' },
                                extra: {
                                    customerId: expiringAddon.customerId,
                                    addonSlug: expiringAddon.addonSlug
                                }
                            });
                            logger.error('Failed to send add-on expiration warning (1 day)', {
                                customerId: expiringAddon.customerId,
                                addonSlug: expiringAddon.addonSlug,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }
            } else {
                logger.error('Failed to find add-ons expiring in 1 day', {
                    error: expiring1DayResult.error
                });
                errors++;
            }

            // 4. Revocation retry phase: pick up orphaned active add-ons linked to cancelled subscriptions.
            // These are purchases that survived a failed webhook processing and must be cleaned up.
            let revocationRetried = 0;
            let revocationErrors = 0;

            logger.info('Starting revocation retry phase for orphaned active add-ons');

            try {
                const db = getDb();

                // Query: active purchases whose subscription is already cancelled.
                // billing_subscriptions uses 'cancelled' (British spelling, 2 L's).
                // GAP-043-050: LIMIT 100 prevents unbounded result sets on large datasets.
                // GAP-043-056: Soft processing-lock check — rows whose metadata contains
                // processingLockTimestamp set within the last 5 minutes are skipped at
                // iteration time (see below), avoiding races with concurrent webhook processing.
                const orphanedPurchases = await db
                    .select({
                        id: billingAddonPurchases.id,
                        customerId: billingAddonPurchases.customerId,
                        addonSlug: billingAddonPurchases.addonSlug,
                        subscriptionId: billingAddonPurchases.subscriptionId,
                        metadata: billingAddonPurchases.metadata
                    })
                    .from(billingAddonPurchases)
                    .innerJoin(
                        billingSubscriptions,
                        eq(billingAddonPurchases.subscriptionId, billingSubscriptions.id)
                    )
                    .where(
                        and(
                            eq(billingAddonPurchases.status, 'active'),
                            isNull(billingAddonPurchases.deletedAt),
                            eq(billingSubscriptions.status, 'cancelled')
                        )
                    )
                    .limit(100);

                logger.info('Found orphaned active add-ons linked to cancelled subscriptions', {
                    count: orphanedPurchases.length
                });

                // Collect customerIds that were successfully revoked to batch cache invalidation.
                const invalidatedCustomerIds = new Set<string>();

                for (const purchase of orphanedPurchases) {
                    const meta = (purchase.metadata ?? {}) as Record<string, unknown>;
                    const retryCount =
                        typeof meta.revocationRetryCount === 'number'
                            ? meta.revocationRetryCount
                            : 0;

                    // Skip purchases that have already exhausted retries.
                    // They were already escalated to Sentry on the run that hit count=3.
                    if (retryCount >= 3) {
                        logger.debug(
                            'Skipping orphaned add-on: revocation retry limit already exhausted',
                            {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug,
                                revocationRetryCount: retryCount
                            }
                        );
                        continue;
                    }

                    // GAP-043-024: Exponential backoff between retries (2, 4, 6 days).
                    // Only applies after the first failed attempt (retryCount > 0).
                    const lastAttempt =
                        typeof meta.lastRevocationAttempt === 'string'
                            ? meta.lastRevocationAttempt
                            : null;
                    if (lastAttempt && retryCount > 0) {
                        const backoffDays = retryCount * 2; // 2, 4, 6 days
                        const nextRetryDate = new Date(lastAttempt);
                        nextRetryDate.setDate(nextRetryDate.getDate() + backoffDays);
                        if (new Date() < nextRetryDate) {
                            logger.debug('Skipping orphaned add-on: backoff window not elapsed', {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug,
                                revocationRetryCount: retryCount,
                                nextRetryDate: nextRetryDate.toISOString()
                            });
                            continue;
                        }
                    }

                    // GAP-043-056: Soft processing-lock check — skip rows being handled by
                    // concurrent webhook processing (lock timestamp set within last 5 minutes).
                    const processingLockTimestamp =
                        typeof meta.processingLockTimestamp === 'string'
                            ? meta.processingLockTimestamp
                            : null;
                    if (processingLockTimestamp) {
                        const lockAge = Date.now() - new Date(processingLockTimestamp).getTime();
                        if (lockAge < 5 * 60 * 1000) {
                            logger.debug(
                                'Skipping orphaned add-on: processing lock held by concurrent handler',
                                {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug,
                                    lockAgeMs: lockAge
                                }
                            );
                            continue;
                        }
                    }

                    if (dryRun) {
                        logger.info('Dry run mode - would revoke orphaned add-on', {
                            purchaseId: purchase.id,
                            customerId: purchase.customerId,
                            addonSlug: purchase.addonSlug,
                            revocationRetryCount: retryCount
                        });
                        revocationRetried++;
                        continue;
                    }

                    try {
                        // GAP-043-058: Verify subscription is actually cancelled in QZPay before
                        // revoking. The DB may reflect cancelled state while QZPay is still active
                        // (split state), which would incorrectly revoke a valid subscription.
                        if (purchase.subscriptionId) {
                            try {
                                const qzpaySubscription = await billing.subscriptions.get(
                                    purchase.subscriptionId
                                );
                                if (
                                    qzpaySubscription &&
                                    (qzpaySubscription.status === 'active' ||
                                        qzpaySubscription.status === 'trialing')
                                ) {
                                    apiLogger.info(
                                        {
                                            purchaseId: purchase.id,
                                            subscriptionId: purchase.subscriptionId,
                                            qzpayStatus: qzpaySubscription.status
                                        },
                                        'Subscription still active in QZPay, skipping revocation'
                                    );
                                    continue;
                                }
                            } catch (qzpayCheckErr) {
                                // If QZPay check fails, proceed with revocation conservatively —
                                // the orphaned state was already confirmed via DB join.
                                logger.warn(
                                    'Could not verify QZPay subscription status, proceeding with revocation',
                                    {
                                        purchaseId: purchase.id,
                                        subscriptionId: purchase.subscriptionId,
                                        error:
                                            qzpayCheckErr instanceof Error
                                                ? qzpayCheckErr.message
                                                : String(qzpayCheckErr)
                                    }
                                );
                            }
                        }

                        const addonDef = getAddonBySlug(purchase.addonSlug);

                        const result = await revokeAddonForSubscriptionCancellation({
                            customerId: purchase.customerId,
                            purchase: { id: purchase.id, addonSlug: purchase.addonSlug },
                            addonDef,
                            billing
                        });

                        if (result.outcome === 'success') {
                            // Mark purchase as canceled (1 L — addon purchase convention).
                            await db
                                .update(billingAddonPurchases)
                                .set({
                                    status: 'canceled',
                                    canceledAt: new Date(),
                                    updatedAt: new Date()
                                })
                                .where(
                                    and(
                                        eq(billingAddonPurchases.id, purchase.id),
                                        eq(billingAddonPurchases.status, 'active')
                                    )
                                );

                            // Defer actual cache invalidation to avoid redundant calls per customer.
                            invalidatedCustomerIds.add(purchase.customerId);
                            revocationRetried++;

                            logger.info(
                                'Successfully revoked orphaned add-on via cron retry phase',
                                {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug,
                                    addonType: result.addonType
                                }
                            );
                        } else {
                            // revokeAddonForSubscriptionCancellation returned outcome='failed'
                            // (only possible for unknown/retired addons in the current implementation,
                            // since known types throw instead of returning failed).
                            const newRetryCount = retryCount + 1;
                            const updatedMeta: Record<string, unknown> = {
                                ...meta,
                                revocationRetryCount: newRetryCount,
                                lastRevocationAttempt: new Date().toISOString()
                            };

                            await db
                                .update(billingAddonPurchases)
                                .set({ metadata: updatedMeta, updatedAt: new Date() })
                                .where(eq(billingAddonPurchases.id, purchase.id));

                            if (newRetryCount >= 3) {
                                Sentry.captureException(
                                    new Error('Addon revocation failed after 3 cron retries'),
                                    {
                                        tags: {
                                            subsystem: 'billing-addon-lifecycle',
                                            action: 'cron_retry_exhausted'
                                        },
                                        extra: {
                                            customerId: purchase.customerId,
                                            purchaseId: purchase.id,
                                            addonSlug: purchase.addonSlug
                                        }
                                    }
                                );
                                logger.error(
                                    'Addon revocation exhausted retries, manual intervention required',
                                    {
                                        purchaseId: purchase.id,
                                        customerId: purchase.customerId,
                                        addonSlug: purchase.addonSlug,
                                        revocationRetryCount: newRetryCount
                                    }
                                );
                            } else {
                                logger.warn(
                                    'Orphaned add-on revocation returned failed outcome, incrementing retry count',
                                    {
                                        purchaseId: purchase.id,
                                        customerId: purchase.customerId,
                                        addonSlug: purchase.addonSlug,
                                        revocationRetryCount: newRetryCount,
                                        error: result.error
                                    }
                                );
                            }

                            revocationErrors++;
                        }
                    } catch (revocationError) {
                        // revokeAddonForSubscriptionCancellation threw (known addon type, both primary + fallback failed).
                        const newRetryCount = retryCount + 1;
                        const updatedMeta: Record<string, unknown> = {
                            ...meta,
                            revocationRetryCount: newRetryCount,
                            lastRevocationAttempt: new Date().toISOString()
                        };

                        try {
                            await db
                                .update(billingAddonPurchases)
                                .set({ metadata: updatedMeta, updatedAt: new Date() })
                                .where(eq(billingAddonPurchases.id, purchase.id));
                        } catch (metaUpdateError) {
                            // Non-fatal: log but don't let this shadow the revocation error.
                            logger.warn('Failed to persist revocation retry count to metadata', {
                                purchaseId: purchase.id,
                                error:
                                    metaUpdateError instanceof Error
                                        ? metaUpdateError.message
                                        : String(metaUpdateError)
                            });
                        }

                        if (newRetryCount >= 3) {
                            Sentry.captureException(
                                new Error('Addon revocation failed after 3 cron retries'),
                                {
                                    tags: {
                                        subsystem: 'billing-addon-lifecycle',
                                        action: 'cron_retry_exhausted'
                                    },
                                    extra: {
                                        customerId: purchase.customerId,
                                        purchaseId: purchase.id,
                                        addonSlug: purchase.addonSlug
                                    }
                                }
                            );
                            logger.error(
                                'Addon revocation exhausted retries, manual intervention required',
                                {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug,
                                    revocationRetryCount: newRetryCount,
                                    error:
                                        revocationError instanceof Error
                                            ? revocationError.message
                                            : String(revocationError)
                                }
                            );
                        } else {
                            logger.error('Orphaned add-on revocation failed, will retry next run', {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug,
                                revocationRetryCount: newRetryCount,
                                error:
                                    revocationError instanceof Error
                                        ? revocationError.message
                                        : String(revocationError)
                            });
                        }

                        revocationErrors++;
                    }
                }

                // Batch cache invalidation — one call per unique customerId that had a successful revocation.
                for (const customerId of invalidatedCustomerIds) {
                    clearEntitlementCache(customerId);
                }

                logger.info('Revocation retry phase completed', {
                    revocationRetried,
                    revocationErrors,
                    cacheInvalidations: invalidatedCustomerIds.size
                });
            } catch (revocationPhaseError) {
                const errMsg =
                    revocationPhaseError instanceof Error
                        ? revocationPhaseError.message
                        : String(revocationPhaseError);

                errors++;

                Sentry.captureException(revocationPhaseError, {
                    tags: { cronJob: 'addon-expiry', phase: 'revocation-retry' }
                });

                logger.error('Revocation retry phase failed with unexpected error', {
                    error: errMsg
                });
            }

            // 5. Reconcile DB-QZPay split state (GAP-043-42)
            // Find subscriptions marked cancelled locally but still active in QZPay.
            // These occur when admin cancel commits the DB transaction BEFORE calling QZPay cancel,
            // and QZPay cancel subsequently fails. Limited to 10 per run to avoid timeout.
            let splitStateReconciled = 0;
            let splitStateErrors = 0;

            logger.info('Starting DB-QZPay split state reconciliation phase');

            try {
                const db = getDb();
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

                // Query subscriptions cancelled locally in the last 7 days
                const recentlyCancelledSubs = await db
                    .select({
                        id: billingSubscriptions.id,
                        customerId: billingSubscriptions.customerId,
                        updatedAt: billingSubscriptions.updatedAt
                    })
                    .from(billingSubscriptions)
                    .where(
                        and(
                            eq(billingSubscriptions.status, 'cancelled'),
                            isNull(billingSubscriptions.deletedAt),
                            sql<boolean>`${billingSubscriptions.updatedAt} > ${sevenDaysAgo}`
                        )
                    )
                    .limit(SPLIT_STATE_BATCH_SIZE);

                logger.info('Found recently cancelled subscriptions to reconcile', {
                    count: recentlyCancelledSubs.length
                });

                for (const sub of recentlyCancelledSubs) {
                    if (dryRun) {
                        logger.info('Dry run mode - would reconcile split-state subscription', {
                            subscriptionId: sub.id,
                            customerId: sub.customerId
                        });
                        splitStateReconciled++;
                        continue;
                    }

                    try {
                        // Check QZPay status for this subscription using the internal ID
                        const qzpaySub = await billing.subscriptions.get(sub.id);

                        if (!qzpaySub) {
                            // Subscription not found in QZPay — already gone, no action needed
                            logger.debug('Subscription not found in QZPay during reconciliation', {
                                subscriptionId: sub.id
                            });
                            continue;
                        }

                        const qzpayStatus = qzpaySub.status;

                        // If QZPay reports active or trialing, DB-QZPay split state confirmed
                        if (qzpayStatus === 'active' || qzpayStatus === 'trialing') {
                            logger.warn(
                                'Split state detected: DB=cancelled but QZPay is active — retrying cancel',
                                {
                                    subscriptionId: sub.id,
                                    customerId: sub.customerId,
                                    qzpayStatus
                                }
                            );

                            // Retry the QZPay cancellation using the internal subscription ID
                            await billing.subscriptions.cancel(sub.id, {
                                cancelAtPeriodEnd: false,
                                reason: 'cron_split_state_reconciliation'
                            });

                            splitStateReconciled++;

                            logger.info('Successfully reconciled split-state subscription', {
                                subscriptionId: sub.id,
                                customerId: sub.customerId
                            });
                        } else {
                            // QZPay already shows cancelled/expired — no split state
                            logger.debug('No split state: QZPay status matches or is terminal', {
                                subscriptionId: sub.id,
                                qzpayStatus
                            });
                        }
                    } catch (reconcileErr) {
                        splitStateErrors++;

                        Sentry.captureException(reconcileErr, {
                            tags: {
                                cronJob: 'addon-expiry',
                                phase: 'split-state-reconciliation'
                            },
                            extra: {
                                subscriptionId: sub.id,
                                customerId: sub.customerId
                            }
                        });

                        logger.error('Failed to reconcile split-state subscription', {
                            subscriptionId: sub.id,
                            customerId: sub.customerId,
                            error:
                                reconcileErr instanceof Error
                                    ? reconcileErr.message
                                    : String(reconcileErr)
                        });
                    }
                }

                logger.info('DB-QZPay split state reconciliation phase completed', {
                    splitStateReconciled,
                    splitStateErrors
                });
            } catch (splitStatePhaseError) {
                const errMsg =
                    splitStatePhaseError instanceof Error
                        ? splitStatePhaseError.message
                        : String(splitStatePhaseError);

                errors++;

                Sentry.captureException(splitStatePhaseError, {
                    tags: { cronJob: 'addon-expiry', phase: 'split-state-reconciliation' }
                });

                logger.error('Split state reconciliation phase failed with unexpected error', {
                    error: errMsg
                });
            }

            // 6. Entitlement reconciliation retry (T-039 / GAP-011)
            // Retries removeAddonEntitlements() for purchases where the initial
            // entitlement removal failed during expiry processing but the DB status
            // was already updated to 'expired'. Tracked via the dedicated boolean column
            // `entitlement_removal_pending` instead of JSONB metadata.
            // Limited to 10 per run to stay within the 2-minute cron window.
            let entitlementReconciled = 0;
            let entitlementReconcileErrors = 0;

            logger.info('Starting entitlement reconciliation phase');

            try {
                const db = getDb();

                const pendingEntitlementRemoval = await db
                    .select({
                        id: billingAddonPurchases.id,
                        customerId: billingAddonPurchases.customerId,
                        addonSlug: billingAddonPurchases.addonSlug,
                        metadata: billingAddonPurchases.metadata
                    })
                    .from(billingAddonPurchases)
                    .where(
                        and(
                            eq(billingAddonPurchases.status, 'expired'),
                            isNull(billingAddonPurchases.deletedAt),
                            eq(billingAddonPurchases.entitlementRemovalPending, true)
                        )
                    )
                    .limit(10);

                logger.info('Found purchases pending entitlement removal', {
                    count: pendingEntitlementRemoval.length
                });

                for (const purchase of pendingEntitlementRemoval) {
                    if (dryRun) {
                        logger.info('Dry run mode - would retry entitlement removal', {
                            purchaseId: purchase.id,
                            customerId: purchase.customerId,
                            addonSlug: purchase.addonSlug
                        });
                        entitlementReconciled++;
                        continue;
                    }

                    try {
                        const meta = (purchase.metadata ?? {}) as Record<string, unknown>;
                        const retryCount =
                            typeof meta.entitlementRemovalRetries === 'number'
                                ? meta.entitlementRemovalRetries
                                : 0;

                        const entitlementService = new AddonEntitlementService(billing);

                        const removeResult = await entitlementService.removeAddonEntitlements({
                            customerId: purchase.customerId,
                            addonSlug: purchase.addonSlug,
                            purchaseId: purchase.id
                        });

                        const newRetryCount = retryCount + 1;

                        if (removeResult.success) {
                            // Clear the dedicated flag column and record the retry count in metadata
                            await db
                                .update(billingAddonPurchases)
                                .set({
                                    entitlementRemovalPending: false,
                                    metadata: {
                                        ...meta,
                                        entitlementRemovalRetries: newRetryCount
                                    },
                                    updatedAt: new Date()
                                })
                                .where(eq(billingAddonPurchases.id, purchase.id));

                            entitlementReconciled++;
                            clearEntitlementCache(purchase.customerId);

                            logger.info('Entitlement removal reconciled successfully', {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug
                            });
                        } else {
                            // Keep flag set; record retry count and escalate to Sentry after 3 retries
                            await db
                                .update(billingAddonPurchases)
                                .set({
                                    metadata: {
                                        ...meta,
                                        entitlementRemovalRetries: newRetryCount
                                    },
                                    updatedAt: new Date()
                                })
                                .where(eq(billingAddonPurchases.id, purchase.id));

                            entitlementReconcileErrors++;

                            if (newRetryCount >= 3) {
                                Sentry.captureException(
                                    new Error(
                                        `Entitlement removal failed after ${newRetryCount} retries`
                                    ),
                                    {
                                        tags: {
                                            cronJob: 'addon-expiry',
                                            phase: 'entitlement-reconciliation'
                                        },
                                        extra: {
                                            purchaseId: purchase.id,
                                            customerId: purchase.customerId,
                                            addonSlug: purchase.addonSlug,
                                            retryCount: newRetryCount
                                        }
                                    }
                                );

                                logger.error(
                                    'Entitlement removal failed after 3 retries — Sentry alert sent',
                                    {
                                        purchaseId: purchase.id,
                                        customerId: purchase.customerId,
                                        addonSlug: purchase.addonSlug,
                                        retryCount: newRetryCount
                                    }
                                );
                            } else {
                                logger.warn(
                                    'Entitlement removal retry failed, will retry next run',
                                    {
                                        purchaseId: purchase.id,
                                        customerId: purchase.customerId,
                                        addonSlug: purchase.addonSlug,
                                        retryCount: newRetryCount
                                    }
                                );
                            }
                        }
                    } catch (reconcileErr) {
                        entitlementReconcileErrors++;

                        Sentry.captureException(reconcileErr, {
                            tags: {
                                cronJob: 'addon-expiry',
                                phase: 'entitlement-reconciliation'
                            },
                            extra: {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug
                            }
                        });

                        logger.error('Unexpected error during entitlement reconciliation', {
                            purchaseId: purchase.id,
                            customerId: purchase.customerId,
                            addonSlug: purchase.addonSlug,
                            error:
                                reconcileErr instanceof Error
                                    ? reconcileErr.message
                                    : String(reconcileErr)
                        });
                    }
                }

                logger.info('Entitlement reconciliation phase completed', {
                    entitlementReconciled,
                    entitlementReconcileErrors
                });
            } catch (entitlementPhaseError) {
                const errMsg =
                    entitlementPhaseError instanceof Error
                        ? entitlementPhaseError.message
                        : String(entitlementPhaseError);

                errors++;

                Sentry.captureException(entitlementPhaseError, {
                    tags: { cronJob: 'addon-expiry', phase: 'entitlement-reconciliation' }
                });

                logger.error('Entitlement reconciliation phase failed with unexpected error', {
                    error: errMsg
                });
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Add-on expiry job completed', {
                processed,
                errors,
                warningsSent,
                revocationRetried,
                revocationErrors,
                splitStateReconciled,
                splitStateErrors,
                entitlementReconciled,
                entitlementReconcileErrors,
                durationMs
            });

            return {
                success: true,
                message: `Processed ${processed} expired add-ons, sent ${warningsSent} warnings, retried ${revocationRetried} revocations, reconciled ${splitStateReconciled} split-state subs, reconciled ${entitlementReconciled} entitlements (${errors} errors)`,
                processed: processed + warningsSent,
                errors,
                durationMs,
                details: {
                    expiredAddons: processed,
                    warningsSent,
                    revocationRetried,
                    revocationErrors,
                    splitStateReconciled,
                    splitStateErrors,
                    entitlementReconciled,
                    entitlementReconcileErrors,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            Sentry.captureException(error, {
                tags: { cronJob: 'addon-expiry', phase: 'top-level' }
            });

            logger.error('Add-on expiry job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to process add-on expiry: ${errorMessage}`,
                processed,
                errors,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        } finally {
            // Always release the advisory lock so the next scheduled run can proceed.
            await lockDb.execute(sql`SELECT pg_advisory_unlock(43001)`);
        }
    }
};
