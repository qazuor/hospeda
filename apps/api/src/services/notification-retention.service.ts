/**
 * Notification Log Retention Service
 *
 * Manages lifecycle of billing notification log entries.
 * - Marks entries older than 90 days as expired (sets expired_at)
 * - Deletes entries that have been expired for more than 30 days
 *
 * This implements a soft delete + hard delete retention policy:
 * 1. Records older than retention period are marked expired (soft delete)
 * 2. Records expired for longer than grace period are permanently deleted (hard delete)
 *
 * Typical cron schedule: daily at 02:00
 *
 * @module services/notification-retention
 */

import { and, billingNotificationLog, getDb, isNotNull, isNull, sql } from '@repo/db';
import { lt } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';

/**
 * Default retention policy configuration
 */
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_GRACE_DAYS = 30;

/** Maximum allowed value for days parameters (10 years) */
const MAX_DAYS = 3650;

/**
 * Validates that a days parameter is a positive integer within bounds
 *
 * @param value - The value to validate
 * @param paramName - Parameter name for error messages
 * @throws {Error} If value is not a positive integer or exceeds MAX_DAYS
 */
function validateDaysParam(value: number, paramName: string): void {
    if (!Number.isInteger(value) || value < 1 || value > MAX_DAYS) {
        throw new Error(`${paramName} must be a positive integer between 1 and ${MAX_DAYS}`);
    }
}

/**
 * Retention policy execution summary
 */
export interface RetentionSummary {
    /** Number of records marked as expired */
    markedExpired: number;
    /** Number of records permanently deleted */
    purged: number;
}

/**
 * Service for managing notification log retention policy
 */
export class NotificationRetentionService {
    /**
     * Mark notification logs older than retention period as expired
     *
     * Sets expired_at = NOW() for notifications where:
     * - created_at < NOW() - retention_days
     * - expired_at IS NULL (not already marked)
     *
     * @param retentionDays - Number of days to retain active records (default: 90)
     * @returns Count of records marked as expired
     */
    async markExpired(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<number> {
        validateDaysParam(retentionDays, 'retentionDays');

        const db = getDb();

        try {
            apiLogger.info({ retentionDays }, 'Starting notification log expiration marking');

            const result = await db
                .update(billingNotificationLog)
                .set({ expiredAt: sql`NOW()` })
                .where(
                    and(
                        lt(
                            billingNotificationLog.createdAt,
                            sql`NOW() - ${retentionDays} * INTERVAL '1 day'`
                        ),
                        isNull(billingNotificationLog.expiredAt)
                    )
                );

            const markedCount = result.rowCount || 0;

            apiLogger.info(
                { retentionDays, markedCount },
                'Notification log expiration marking completed'
            );

            return markedCount;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { retentionDays, error: errorMessage },
                'Failed to mark expired notification logs'
            );

            throw error;
        }
    }

    /**
     * Permanently delete notification logs that have been expired for grace period
     *
     * Deletes notifications where:
     * - expired_at IS NOT NULL
     * - expired_at < NOW() - grace_days
     *
     * @param graceDays - Number of days to keep expired records before deletion (default: 30)
     * @returns Count of records permanently deleted
     */
    async purgeExpired(graceDays: number = DEFAULT_GRACE_DAYS): Promise<number> {
        validateDaysParam(graceDays, 'graceDays');

        const db = getDb();

        try {
            apiLogger.info({ graceDays }, 'Starting notification log purge');

            const result = await db
                .delete(billingNotificationLog)
                .where(
                    and(
                        isNotNull(billingNotificationLog.expiredAt),
                        lt(
                            billingNotificationLog.expiredAt,
                            sql`NOW() - ${graceDays} * INTERVAL '1 day'`
                        )
                    )
                );

            const purgedCount = result.rowCount || 0;

            apiLogger.info({ graceDays, purgedCount }, 'Notification log purge completed');

            return purgedCount;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { graceDays, error: errorMessage },
                'Failed to purge expired notification logs'
            );

            throw error;
        }
    }

    /**
     * Run complete retention policy (mark + purge)
     *
     * Executes both steps of the retention policy:
     * 1. Mark old records as expired
     * 2. Purge long-expired records
     *
     * @param retentionDays - Days to retain active records (default: 90)
     * @param graceDays - Days to keep expired records (default: 30)
     * @returns Summary with counts of marked and purged records
     */
    async runRetentionPolicy(
        retentionDays: number = DEFAULT_RETENTION_DAYS,
        graceDays: number = DEFAULT_GRACE_DAYS
    ): Promise<RetentionSummary> {
        try {
            apiLogger.info(
                { retentionDays, graceDays },
                'Starting notification log retention policy execution'
            );

            // Step 1: Mark expired
            const markedExpired = await this.markExpired(retentionDays);

            // Step 2: Purge old expired records
            const purged = await this.purgeExpired(graceDays);

            const summary: RetentionSummary = {
                markedExpired,
                purged
            };

            apiLogger.info(summary, 'Notification log retention policy execution completed');

            return summary;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { retentionDays, graceDays, error: errorMessage },
                'Failed to run notification log retention policy'
            );

            throw error;
        }
    }
}
