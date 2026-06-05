/**
 * Add-on Expiry Cron Job
 *
 * Processes expired add-ons and sends expiration warnings.
 * Runs daily at 5:00 UTC (2:00 AM Argentina time).
 *
 * Features:
 * - Finds and expires add-ons that have passed their expiration date
 * - Sends ADDON_EXPIRED notification for each expired add-on
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 3 days
 * - Sends ADDON_EXPIRATION_WARNING for add-ons expiring in 1 day
 * - Uses idempotency keys to prevent duplicate notifications
 * - Fire-and-forget pattern for notification sending
 * - Single-source-of-truth expiry: findExpiredAddons() is called once; the same
 *   list drives both expireAddon() calls and the ADDON_EXPIRED notification loop,
 *   eliminating the between-fetch gap (SPEC-194 T-014)
 * - Chunked parallel expiry processing (EXPIRY_CHUNK_SIZE items/chunk, bounded
 *   concurrency via Promise.allSettled) to stay within the 2-minute cron timeout
 *   for large batches (SPEC-194 T-015)
 * - Revocation retry phase for orphaned active add-ons linked to cancelled subscriptions
 *
 * @module cron/jobs/addon-expiry
 */

import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingAddonPurchases,
    billingNotificationLog,
    billingSubscriptions,
    eq,
    getDb,
    isNull,
    withTransaction
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { AddonCatalogService } from '@repo/service-core';
import { chunkArray } from '@repo/utils';
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

// ─── Catalog service (DB-backed addon reads — SPEC-192 T-015) ─────────────────
// Replaces static `getAddonBySlug` from `@repo/billing` for display-name
// resolution and revocation retry. Instantiated once at module level.
const catalogService = new AddonCatalogService();

/**
 * Number of expired addon purchases to process concurrently per chunk (SPEC-194 T-015).
 * Bounded concurrency prevents the cron from hitting the 2-minute timeout with large
 * batches while still parallelising per-item work within each chunk. Value of 5
 * balances DB connection pressure against throughput.
 */
const EXPIRY_CHUNK_SIZE = 5;

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
 * Accepts an optional `tx` parameter so the idempotency check runs within the same
 * transaction that holds the advisory lock, ensuring consistent reads.
 *
 * @param type - Notification type
 * @param customerId - Billing customer ID
 * @param addonSlug - Add-on slug (included in idempotency key)
 * @param tx - Optional transaction client. When provided, runs within that transaction.
 * @returns Whether notification was already sent today for this specific addon
 */
async function wasNotificationSent(
    type: NotificationType,
    customerId: string,
    addonSlug: string,
    tx: DrizzleClient
): Promise<boolean> {
    try {
        const db = tx;
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
 * A Phase 7 row selected inside the lock tx and processed outside (item 7 fix).
 * Only the fields needed for the post-tx grant + flag-clear are carried over.
 */
interface PendingGrantRow {
    readonly id: string;
    readonly customerId: string;
    readonly addonSlug: string;
    readonly metadata: unknown;
}

/**
 * Discriminated union returned by the withTransaction callback in the cron handler.
 * Allows the outer handler to distinguish lock-skip from real execution results.
 *
 * `pendingPostTxGrants` carries Phase 7 rows selected inside the lock tx so
 * the per-row grant + flag-clear can run AFTER the tx commits (item 7 fix).
 * External QZPay grant calls must not run while the advisory lock is held.
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
          readonly details: Record<string, unknown>;
          /** Phase 7 rows to process after the tx commits (external QZPay calls). */
          readonly pendingPostTxGrants: readonly PendingGrantRow[];
      };

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
        // Lock key 43001 is reserved for this job. Uses pg_try_advisory_xact_lock (transaction-level)
        // instead of pg_try_advisory_lock (session-level) so the lock survives correctly
        // under transaction-mode connection poolers (PgBouncer, Coolify pooled clients, etc.).
        // Transaction-level locks auto-release on commit/rollback — no manual unlock needed.
        // If a previous run still holds the lock, we skip immediately.
        //
        // The entire cron body runs inside withTransaction so the lock remains held until
        // the transaction commits at the end. This keeps the lock valid across all DB phases.
        // Service calls (AddonExpirationService, etc.) that internally call getDb() run outside
        // the tx scope — they are not part of the critical section but cannot be refactored here.
        let processed = 0;
        let failed = 0;
        let errors = 0;
        let warningsSent = 0;

        // Idempotency is now handled via billing_notification_log DB lookups
        // instead of an in-memory Set, so state persists across cron runs.

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                // Acquire transaction-level advisory lock (non-blocking).
                // pg_try_advisory_xact_lock holds the lock for the duration of the
                // enclosing transaction, then releases automatically on commit/rollback.
                // Compatible with transaction-mode connection poolers (PgBouncer, etc.).
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(43001) as acquired`
                );
                const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)
                    ?.acquired;

                if (!acquired) {
                    return { skipped: true };
                }

                // Set statement timeout for the cron transaction window (2 minutes).
                await tx.execute(sql`SET LOCAL statement_timeout = '120000'`);

                // Ensure billing is initialized before proceeding
                const billing = getQZPayBilling();
                if (!billing) {
                    apiLogger.error('QZPay billing not initialized, skipping addon expiry job');
                    return {
                        skipped: false,
                        success: false,
                        message: 'QZPay billing not initialized, skipping addon expiry job',
                        processed: 0,
                        errors: 1,
                        durationMs: Date.now() - startedAt.getTime(),
                        details: { error: 'billing_not_initialized' },
                        pendingPostTxGrants: []
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
                    // Production mode — single-source-of-truth expiry (SPEC-194 T-014).
                    // findExpiredAddons() is called ONCE. The resulting list drives both the
                    // per-item expireAddon() calls AND the ADDON_EXPIRED notification loop,
                    // so no addon can fall into the between-fetch gap that existed when
                    // processExpiredAddons() ran its own internal findExpiredAddons() query.
                    const findResult = await addonExpirationService.findExpiredAddons();

                    if (findResult.success) {
                        const addonsToExpire = findResult.data ?? [];

                        logger.info('Found expired add-ons to process', {
                            count: addonsToExpire.length
                        });

                        // Track which purchase IDs failed so we skip their notifications below.
                        const failedPurchaseIds = new Set<string>();

                        // Chunked parallel expiry (SPEC-194 T-015 / GAP-038-42).
                        // Sequential processing of large batches can exceed the 2-minute cron
                        // window. Chunks of EXPIRY_CHUNK_SIZE items are fanned out concurrently
                        // via Promise.allSettled — per-item error isolation is preserved: one
                        // failure never aborts the rest of the chunk or any subsequent chunk.
                        const chunks = chunkArray(addonsToExpire, EXPIRY_CHUNK_SIZE);

                        for (const chunk of chunks) {
                            const chunkResults = await Promise.allSettled(
                                chunk.map((addon) =>
                                    addonExpirationService.expireAddon({ purchaseId: addon.id })
                                )
                            );

                            for (let i = 0; i < chunkResults.length; i++) {
                                const settledResult = chunkResults[i];
                                const addon = chunk[i];
                                if (!addon || !settledResult) continue;

                                if (settledResult.status === 'rejected') {
                                    failed++;
                                    errors++;
                                    failedPurchaseIds.add(addon.id);
                                    Sentry.captureException(settledResult.reason, {
                                        tags: {
                                            cronJob: 'addon-expiry',
                                            phase: 'expire-addon'
                                        },
                                        extra: {
                                            purchaseId: addon.id,
                                            customerId: addon.customerId,
                                            addonSlug: addon.addonSlug
                                        }
                                    });
                                    logger.error('expireAddon threw unexpectedly', {
                                        purchaseId: addon.id,
                                        customerId: addon.customerId,
                                        addonSlug: addon.addonSlug,
                                        error:
                                            settledResult.reason instanceof Error
                                                ? settledResult.reason.message
                                                : String(settledResult.reason)
                                    });
                                } else if (settledResult.value.success) {
                                    processed++;
                                } else {
                                    failed++;
                                    errors++;
                                    failedPurchaseIds.add(addon.id);
                                    logger.warn('expireAddon returned failure', {
                                        purchaseId: addon.id,
                                        customerId: addon.customerId,
                                        addonSlug: addon.addonSlug,
                                        error: settledResult.value.error
                                    });
                                }
                            }
                        }

                        logger.info('Processed expired add-ons', {
                            processed,
                            failed
                        });

                        // Send ADDON_EXPIRED notification for each successfully expired add-on.
                        // Iterates the SAME list that was just expired — no second DB fetch,
                        // no between-fetch gap (SPEC-194 T-014 fix).
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
                                        expiredAddon.addonSlug,
                                        tx
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

                                // SPEC-192 T-015: resolve display name from DB-backed catalog; fall back to slug
                                const addonCatalogExpired = await catalogService.getBySlug(
                                    expiredAddon.addonSlug
                                );
                                const addonDisplayNameExpired = addonCatalogExpired.success
                                    ? addonCatalogExpired.data.name
                                    : expiredAddon.addonSlug;

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
                    } else {
                        logger.error('Failed to find expired add-ons', {
                            error: findResult.error
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
                                        expiringAddon.addonSlug,
                                        tx
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

                                // SPEC-192 T-015: resolve display name from DB-backed catalog; fall back to slug
                                const addonCatalog3d = await catalogService.getBySlug(
                                    expiringAddon.addonSlug
                                );
                                const addonDisplayName3d = addonCatalog3d.success
                                    ? addonCatalog3d.data.name
                                    : expiringAddon.addonSlug;

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
                                        expiringAddon.addonSlug,
                                        tx
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

                                // SPEC-192 T-015: resolve display name from DB-backed catalog; fall back to slug
                                const addonCatalog1d = await catalogService.getBySlug(
                                    expiringAddon.addonSlug
                                );
                                const addonDisplayName1d = addonCatalog1d.success
                                    ? addonCatalog1d.data.name
                                    : expiringAddon.addonSlug;

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
                    // Use the transaction-scoped db handle so writes participate in the
                    // same transaction that holds the advisory lock.
                    const db = tx;

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
                                logger.debug(
                                    'Skipping orphaned add-on: backoff window not elapsed',
                                    {
                                        purchaseId: purchase.id,
                                        customerId: purchase.customerId,
                                        addonSlug: purchase.addonSlug,
                                        revocationRetryCount: retryCount,
                                        nextRetryDate: nextRetryDate.toISOString()
                                    }
                                );
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
                            const lockAge =
                                Date.now() - new Date(processingLockTimestamp).getTime();
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

                            // SPEC-192 T-015: resolve addon definition from DB-backed catalog.
                            // NOT_FOUND → undefined (triggers "unknown/retired" path in revoke helper).
                            const addonCatalogResult = await catalogService.getBySlug(
                                purchase.addonSlug
                            );
                            const addonDef = addonCatalogResult.success
                                ? addonCatalogResult.data
                                : undefined;

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
                                logger.warn(
                                    'Failed to persist revocation retry count to metadata',
                                    {
                                        purchaseId: purchase.id,
                                        error:
                                            metaUpdateError instanceof Error
                                                ? metaUpdateError.message
                                                : String(metaUpdateError)
                                    }
                                );
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
                                logger.error(
                                    'Orphaned add-on revocation failed, will retry next run',
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
                    // Use the transaction-scoped db handle (same lock-holding transaction).
                    const db = tx;
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
                                logger.debug(
                                    'Subscription not found in QZPay during reconciliation',
                                    {
                                        subscriptionId: sub.id
                                    }
                                );
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
                                logger.debug(
                                    'No split state: QZPay status matches or is terminal',
                                    {
                                        subscriptionId: sub.id,
                                        qzpayStatus
                                    }
                                );
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
                    // Use the transaction-scoped db handle (same lock-holding transaction).
                    const db = tx;

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

                // 7. Grant reconciliation — CLAIM phase (item 7 / SPEC-194 adversarial review).
                //
                // Only the SELECT runs here, inside the lock-holding tx. The per-row
                // grant + flag-clear (external QZPay calls + DB writes) run AFTER the tx
                // commits so external calls never hold the advisory lock (ADR-019 §Negative).
                // Mirrors the trial claim/process split from T-005.
                //
                // Idempotency: re-applying is safe because qzpay-drizzle's entitlements
                // grant() is upsert-style — it finds the active grant for
                // (customerId, entitlementKey) and updates/returns it instead of inserting
                // a duplicate. Verified at qzpay packages/drizzle/src/repositories/
                // entitlements.repository.ts:133-152 (item 6 / SPEC-194 adversarial review).
                let claimedGrantRows: PendingGrantRow[] = [];
                let grantDryRunCount = 0;

                logger.info('Starting grant reconciliation phase for split-state purchases');

                try {
                    const db = tx;

                    const pendingGrantSync = await db
                        .select({
                            id: billingAddonPurchases.id,
                            customerId: billingAddonPurchases.customerId,
                            addonSlug: billingAddonPurchases.addonSlug,
                            needsEntitlementSync: billingAddonPurchases.needsEntitlementSync,
                            metadata: billingAddonPurchases.metadata
                        })
                        .from(billingAddonPurchases)
                        .where(
                            and(
                                eq(billingAddonPurchases.status, 'active'),
                                isNull(billingAddonPurchases.deletedAt),
                                eq(billingAddonPurchases.needsEntitlementSync, true)
                            )
                        )
                        .limit(10);

                    logger.info('Found active purchases with missing entitlement grants', {
                        count: pendingGrantSync.length
                    });

                    if (dryRun) {
                        // Dry-run: count only — no external calls, nothing to defer post-tx.
                        for (const purchase of pendingGrantSync) {
                            logger.info(
                                'Dry run mode - would re-apply entitlement grant for split-state purchase',
                                {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug
                                }
                            );
                            grantDryRunCount++;
                        }
                    } else {
                        // Production: store rows to process after tx commits.
                        // The advisory lock releases on commit; external calls run outside.
                        claimedGrantRows = pendingGrantSync.map((p) => ({
                            id: p.id,
                            customerId: p.customerId,
                            addonSlug: p.addonSlug,
                            metadata: p.metadata
                        }));
                    }
                } catch (grantPhaseError) {
                    const errMsg =
                        grantPhaseError instanceof Error
                            ? grantPhaseError.message
                            : String(grantPhaseError);

                    errors++;

                    Sentry.captureException(grantPhaseError, {
                        tags: { cronJob: 'addon-expiry', phase: 'grant-reconciliation-claim' }
                    });

                    logger.error('Grant reconciliation claim phase failed with unexpected error', {
                        error: errMsg
                    });
                }

                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Add-on expiry job (lock phase) completed', {
                    processed,
                    errors,
                    warningsSent,
                    revocationRetried,
                    revocationErrors,
                    splitStateReconciled,
                    splitStateErrors,
                    entitlementReconciled,
                    entitlementReconcileErrors,
                    grantClaimedCount: claimedGrantRows.length,
                    grantDryRunCount,
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: `Processed ${processed} expired add-ons, sent ${warningsSent} warnings, retried ${revocationRetried} revocations, reconciled ${splitStateReconciled} split-state subs, reconciled ${entitlementReconciled} entitlements, ${claimedGrantRows.length} grant rows claimed for post-tx processing (${errors} errors)`,
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
                        grantReconciled: grantDryRunCount, // dry-run only; live count set post-tx
                        grantReconcileErrors: 0,
                        dryRun
                    },
                    pendingPostTxGrants: claimedGrantRows
                };
                // End of withTransaction callback — advisory lock auto-releases on commit
            });

            // Handle lock-not-acquired case from inside the transaction
            if (cronResult.skipped) {
                apiLogger.warn(
                    'addon-expiry cron: skipping — previous run still holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped: previous run still active (advisory lock not acquired)',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { skipped: true, reason: 'lock_not_acquired' }
                };
            }

            // ── Phase 7 PROCESS phase (item 7 / SPEC-194 adversarial review) ──────────
            // The advisory lock has been released (tx committed). Now run the external
            // QZPay grant calls and DB flag-clears without holding the lock.
            let grantReconciled = 0;
            let grantReconcileErrors = 0;

            if (cronResult.pendingPostTxGrants.length > 0) {
                const postTxDb = getDb();
                const billing = getQZPayBilling();

                if (billing) {
                    logger.info('Starting grant reconciliation post-tx processing', {
                        count: cronResult.pendingPostTxGrants.length
                    });

                    for (const purchase of cronResult.pendingPostTxGrants) {
                        try {
                            const entitlementService = new AddonEntitlementService(billing);

                            const applyResult = await entitlementService.applyAddonEntitlements({
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug,
                                purchaseId: purchase.id
                            });

                            const meta = (purchase.metadata ?? {}) as Record<string, unknown>;
                            const retryCount =
                                typeof meta.grantSyncRetries === 'number'
                                    ? meta.grantSyncRetries
                                    : 0;
                            const newRetryCount = retryCount + 1;

                            if (applyResult.success) {
                                await postTxDb
                                    .update(billingAddonPurchases)
                                    .set({
                                        needsEntitlementSync: false,
                                        metadata: { ...meta, grantSyncRetries: newRetryCount },
                                        updatedAt: new Date()
                                    })
                                    .where(eq(billingAddonPurchases.id, purchase.id));

                                grantReconciled++;
                                clearEntitlementCache(purchase.customerId);

                                logger.info('Grant reconciliation succeeded (post-tx)', {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug
                                });
                            } else {
                                await postTxDb
                                    .update(billingAddonPurchases)
                                    .set({
                                        metadata: { ...meta, grantSyncRetries: newRetryCount },
                                        updatedAt: new Date()
                                    })
                                    .where(eq(billingAddonPurchases.id, purchase.id));

                                grantReconcileErrors++;

                                if (newRetryCount >= 3) {
                                    Sentry.captureException(
                                        new Error(
                                            `Entitlement grant reconciliation failed after ${newRetryCount} retries`
                                        ),
                                        {
                                            tags: {
                                                cronJob: 'addon-expiry',
                                                phase: 'grant-reconciliation'
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
                                        'Grant reconciliation failed after 3 retries — Sentry alert sent',
                                        {
                                            purchaseId: purchase.id,
                                            customerId: purchase.customerId,
                                            addonSlug: purchase.addonSlug,
                                            retryCount: newRetryCount
                                        }
                                    );
                                } else {
                                    logger.warn(
                                        'Grant reconciliation retry failed, will retry next run',
                                        {
                                            purchaseId: purchase.id,
                                            customerId: purchase.customerId,
                                            addonSlug: purchase.addonSlug,
                                            retryCount: newRetryCount
                                        }
                                    );
                                }
                            }
                        } catch (grantErr) {
                            grantReconcileErrors++;

                            Sentry.captureException(grantErr, {
                                tags: { cronJob: 'addon-expiry', phase: 'grant-reconciliation' },
                                extra: {
                                    purchaseId: purchase.id,
                                    customerId: purchase.customerId,
                                    addonSlug: purchase.addonSlug
                                }
                            });

                            logger.error('Unexpected error during grant reconciliation (post-tx)', {
                                purchaseId: purchase.id,
                                customerId: purchase.customerId,
                                addonSlug: purchase.addonSlug,
                                error:
                                    grantErr instanceof Error ? grantErr.message : String(grantErr)
                            });
                        }
                    }

                    logger.info('Grant reconciliation post-tx processing completed', {
                        grantReconciled,
                        grantReconcileErrors
                    });
                } else {
                    apiLogger.error(
                        'Grant reconciliation post-tx: billing not initialized, skipping grant processing'
                    );
                    grantReconcileErrors += cronResult.pendingPostTxGrants.length;
                }
            }

            // Merge the live post-tx grant counts into the result details.
            // In dry-run mode pendingPostTxGrants is always empty and grantReconciled=0;
            // preserve the dry-run count (set inside the tx) instead of overwriting it.
            const mergedDetails = dryRun
                ? cronResult.details
                : { ...cronResult.details, grantReconciled, grantReconcileErrors };

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                details: mergedDetails
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
        // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
        // transaction commit/rollback. The lock was scoped to the withTransaction call above.
    }
};
