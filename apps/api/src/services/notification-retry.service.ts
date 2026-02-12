/**
 * Database-based Notification Retry Service
 *
 * Fallback retry mechanism for failed notifications when Redis is not available.
 * Reads failed notifications from billing_notification_log and retries them.
 *
 * Configuration:
 * - MAX_RETRIES: 3 attempts total
 * - RETRY_WINDOW_HOURS: Only retry notifications from last 24 hours
 * - RETRY_COOLDOWN_MINUTES: Wait 60 minutes between retry attempts
 *
 * @module services/notification-retry
 */

import { billingNotificationLog, getDb } from '@repo/db';
import { type NotificationPayload, NotificationType } from '@repo/notifications';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
    /** Maximum retry attempts (including original) */
    MAX_RETRIES: 3,
    /** Only retry notifications from last N hours */
    RETRY_WINDOW_HOURS: 24,
    /** Wait N minutes between retry attempts */
    RETRY_COOLDOWN_MINUTES: 60,
    /** Critical notification types that should be retried */
    CRITICAL_TYPES: [
        NotificationType.TRIAL_EXPIRED,
        NotificationType.TRIAL_ENDING_REMINDER,
        NotificationType.PAYMENT_FAILURE,
        NotificationType.ADDON_EXPIRED,
        NotificationType.RENEWAL_REMINDER
    ] as string[]
};

/**
 * Failed notification record from database
 */
interface FailedNotificationRecord {
    id: string;
    customerId: string | null;
    type: string;
    recipient: string;
    subject: string;
    status: string;
    errorMessage: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}

/**
 * Retry statistics
 */
export interface RetryStats {
    processed: number;
    succeeded: number;
    failed: number;
    permanentlyFailed: number;
}

/**
 * Process database-based notification retries
 *
 * Queries failed notifications from billing_notification_log and attempts
 * to resend them. Updates status on success or marks as permanently failed
 * after max retries.
 *
 * @param dryRun - If true, only report what would be retried without sending
 * @returns Retry statistics
 *
 * @example
 * ```ts
 * const stats = await processDbNotificationRetries();
 * console.log(`Retried ${stats.processed}, succeeded ${stats.succeeded}`);
 * ```
 */
export async function processDbNotificationRetries(dryRun = false): Promise<RetryStats> {
    const stats: RetryStats = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        permanentlyFailed: 0
    };

    const db = getDb();

    try {
        // Calculate retry window
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - RETRY_CONFIG.RETRY_WINDOW_HOURS);

        // Calculate cooldown threshold (don't retry if failed less than N minutes ago)
        const cooldownThreshold = new Date();
        cooldownThreshold.setMinutes(
            cooldownThreshold.getMinutes() - RETRY_CONFIG.RETRY_COOLDOWN_MINUTES
        );

        // Query failed notifications within window, respecting cooldown
        const failedNotifications = await db
            .select({
                id: billingNotificationLog.id,
                customerId: billingNotificationLog.customerId,
                type: billingNotificationLog.type,
                recipient: billingNotificationLog.recipient,
                subject: billingNotificationLog.subject,
                status: billingNotificationLog.status,
                errorMessage: billingNotificationLog.errorMessage,
                metadata: billingNotificationLog.metadata,
                createdAt: billingNotificationLog.createdAt
            })
            .from(billingNotificationLog)
            .where(
                and(
                    eq(billingNotificationLog.status, 'failed'),
                    gte(billingNotificationLog.createdAt, windowStart),
                    lt(billingNotificationLog.createdAt, cooldownThreshold),
                    isNull(billingNotificationLog.expiredAt) // Not already marked as permanently failed
                )
            )
            .limit(50); // Process in batches

        if (failedNotifications.length === 0) {
            apiLogger.debug('No failed notifications ready for retry');
            return stats;
        }

        apiLogger.info(
            { count: failedNotifications.length },
            'Processing failed notifications for retry'
        );

        // Process each failed notification
        for (const notification of failedNotifications) {
            stats.processed++;

            // Check if this is a critical notification type
            const isCritical = RETRY_CONFIG.CRITICAL_TYPES.includes(notification.type);

            if (!isCritical) {
                apiLogger.debug(
                    { type: notification.type, id: notification.id },
                    'Skipping non-critical notification type'
                );
                continue;
            }

            // Get retry count from metadata
            const retryCount =
                (notification.metadata as Record<string, unknown> | null)?.retryCount ?? 0;
            const currentRetryCount = Number(retryCount);

            if (currentRetryCount >= RETRY_CONFIG.MAX_RETRIES) {
                // Mark as permanently failed
                stats.permanentlyFailed++;

                if (!dryRun) {
                    await db
                        .update(billingNotificationLog)
                        .set({
                            expiredAt: new Date(),
                            metadata: sql`${billingNotificationLog.metadata} || '{"permanentlyFailed": true}'::jsonb`
                        })
                        .where(eq(billingNotificationLog.id, notification.id));
                }

                apiLogger.warn(
                    { type: notification.type, id: notification.id, retries: currentRetryCount },
                    'Notification permanently failed after max retries'
                );
                continue;
            }

            if (dryRun) {
                apiLogger.info(
                    { type: notification.type, id: notification.id, retryCount: currentRetryCount },
                    'Would retry notification (dry run)'
                );
                continue;
            }

            // Reconstruct notification payload from metadata
            const payload = reconstructPayload(notification);

            if (!payload) {
                apiLogger.error(
                    { type: notification.type, id: notification.id },
                    'Could not reconstruct notification payload for retry'
                );
                stats.failed++;
                continue;
            }

            try {
                // Attempt to send notification
                await sendNotification(payload);

                // Update status to sent
                await db
                    .update(billingNotificationLog)
                    .set({
                        status: 'sent',
                        sentAt: new Date(),
                        errorMessage: null,
                        metadata: sql`${billingNotificationLog.metadata} || '{"retriedSuccessfully": true, "retryCount": ${currentRetryCount + 1}}'::jsonb`
                    })
                    .where(eq(billingNotificationLog.id, notification.id));

                stats.succeeded++;

                apiLogger.info(
                    {
                        type: notification.type,
                        id: notification.id,
                        retryCount: currentRetryCount + 1
                    },
                    'Notification retry succeeded'
                );
            } catch (error) {
                // Update retry count
                await db
                    .update(billingNotificationLog)
                    .set({
                        metadata: sql`${billingNotificationLog.metadata} || '{"retryCount": ${currentRetryCount + 1}}'::jsonb`,
                        errorMessage: error instanceof Error ? error.message : 'Unknown retry error'
                    })
                    .where(eq(billingNotificationLog.id, notification.id));

                stats.failed++;

                apiLogger.error(
                    {
                        type: notification.type,
                        id: notification.id,
                        retryCount: currentRetryCount + 1,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Notification retry failed'
                );
            }
        }

        apiLogger.info(stats, 'Database-based notification retry complete');

        return stats;
    } catch (error) {
        apiLogger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'Failed to process database-based notification retries'
        );
        return stats;
    }
}

/**
 * Reconstruct NotificationPayload from database record
 *
 * @param record - Failed notification record
 * @returns NotificationPayload or null if reconstruction fails
 */
function reconstructPayload(record: FailedNotificationRecord): NotificationPayload | null {
    const metadata = (record.metadata || {}) as Record<string, unknown>;

    // Base payload fields
    const basePayload = {
        type: record.type as NotificationType,
        recipientEmail: record.recipient,
        recipientName: (metadata.recipientName as string) || record.recipient.split('@')[0],
        userId: (metadata.userId as string) || '',
        customerId: record.customerId || undefined,
        idempotencyKey: `retry-${record.id}-${Date.now()}`
    };

    // Add type-specific fields from metadata
    switch (record.type) {
        case NotificationType.TRIAL_EXPIRED:
        case NotificationType.TRIAL_ENDING_REMINDER:
            return {
                ...basePayload,
                planName: (metadata.planName as string) || 'Plan',
                trialEndDate: (metadata.trialEndDate as string) || new Date().toISOString(),
                daysRemaining: (metadata.daysRemaining as number) || 0,
                upgradeUrl: (metadata.upgradeUrl as string) || ''
            } as NotificationPayload;

        case NotificationType.PAYMENT_FAILURE:
            return {
                ...basePayload,
                amount: (metadata.amount as number) || 0,
                currency: (metadata.currency as string) || 'ARS',
                planName: (metadata.planName as string) || '',
                failureReason: (metadata.failureReason as string) || 'Unknown',
                retryDate: (metadata.retryDate as string) || ''
            } as NotificationPayload;

        case NotificationType.ADDON_EXPIRED:
            return {
                ...basePayload,
                addonName: (metadata.addonName as string) || 'Add-on',
                expirationDate: (metadata.expirationDate as string) || new Date().toISOString()
            } as NotificationPayload;

        case NotificationType.RENEWAL_REMINDER:
            return {
                ...basePayload,
                planName: (metadata.planName as string) || 'Plan',
                amount: (metadata.amount as number) || 0,
                currency: (metadata.currency as string) || 'ARS',
                renewalDate: (metadata.renewalDate as string) || ''
            } as NotificationPayload;

        default:
            // For other types, return base payload
            // May not have all required fields
            return basePayload as NotificationPayload;
    }
}
