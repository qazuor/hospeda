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
                // Production mode - actually expire add-ons
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
                const orphanedPurchases = await db
                    .select({
                        id: billingAddonPurchases.id,
                        customerId: billingAddonPurchases.customerId,
                        addonSlug: billingAddonPurchases.addonSlug,
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
                    );

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

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Add-on expiry job completed', {
                processed,
                errors,
                warningsSent,
                revocationRetried,
                revocationErrors,
                durationMs
            });

            return {
                success: true,
                message: `Processed ${processed} expired add-ons, sent ${warningsSent} warnings, retried ${revocationRetried} revocations (${errors} errors)`,
                processed: processed + warningsSent,
                errors,
                durationMs,
                details: {
                    expiredAddons: processed,
                    warningsSent,
                    revocationRetried,
                    revocationErrors,
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
        }
    }
};
