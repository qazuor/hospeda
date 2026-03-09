/**
 * Billing Usage Service
 *
 * Provides system-wide usage statistics and customer limit monitoring
 * for the billing admin dashboard.
 *
 * Exposes two read-only query functions:
 * - `getSystemUsage` - aggregate subscription/payment/addon counts
 * - `getApproachingLimits` - customers near their plan limits
 *
 * @module services/billing-usage
 */

import { getDb, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { apiLogger } from '../utils/logger';
import type { ServiceResult } from './billing-metrics.service';

/**
 * Plan usage statistics for admin overview
 */
export interface PlanUsageStats {
    planSlug: string;
    planName: string;
    customerCount: number;
    averageUsage: Record<string, number>;
}

/**
 * System-wide usage statistics for admin overview
 * Matches the frontend SystemUsageStats interface
 */
export interface SystemUsageStats {
    /** Total number of billing customers */
    totalCustomers: number;
    /** Customer counts by category */
    customersByCategory: Record<string, number>;
    /** Plan subscription statistics */
    planStats: PlanUsageStats[];
    /** Top limits approaching capacity */
    topLimits: Array<{
        limitKey: string;
        limitName: string;
        averageUsage: number;
        customersAtCapacity: number;
    }>;
}

/**
 * A single customer limit that is approaching or exceeding the configured threshold
 */
export interface ApproachingLimitItem {
    /** Customer ID */
    customerId: string;
    /** Customer email */
    customerEmail: string;
    /** Limit key identifier (e.g. "api_calls", "accommodations") */
    limitKey: string;
    /** Current usage value */
    currentUsage: number;
    /** Maximum allowed value */
    maxAllowed: number;
    /** Usage as a percentage of the maximum (0-100, rounded to 2 decimals) */
    usagePercentage: number;
}

/**
 * Get system-wide usage statistics.
 *
 * Aggregates counts from subscriptions, payments, and add-on purchases
 * to provide an operational overview for administrators.
 * All eight queries are executed in parallel for minimal latency.
 *
 * @param livemode - Whether to fetch live or test mode data (default: true)
 * @returns System usage statistics
 */
export async function getSystemUsage(livemode = true): Promise<ServiceResult<SystemUsageStats>> {
    try {
        const db = getDb();

        const [customersResult, customersByCategoryResult, planStatsResult] = await Promise.all([
            db.execute(sql`
                SELECT COUNT(*) as count
                FROM billing_customers
                WHERE livemode = ${livemode}
                AND deleted_at IS NULL
            `),
            db.execute(sql`
                SELECT COALESCE(segment, 'unknown') as category, COUNT(*) as count
                FROM billing_customers
                WHERE livemode = ${livemode}
                AND deleted_at IS NULL
                GROUP BY segment
            `),
            db.execute(sql`
                SELECT
                    plan_id as plan_slug,
                    plan_id as plan_name,
                    COUNT(*) as customer_count
                FROM billing_subscriptions
                WHERE status IN ('active', 'trialing')
                AND livemode = ${livemode}
                AND deleted_at IS NULL
                GROUP BY plan_id
                ORDER BY customer_count DESC
            `)
        ]);

        // Build customersByCategory from segment column
        const customersByCategory: Record<string, number> = {
            owner: 0,
            complex: 0,
            tourist: 0
        };
        for (const row of customersByCategoryResult.rows) {
            const cat = String(row.category ?? 'unknown');
            if (cat in customersByCategory) {
                customersByCategory[cat] = Number(row.count);
            } else {
                // Map unknown segments to a fallback
                customersByCategory[cat] = Number(row.count);
            }
        }

        // Build planStats
        const planStats: PlanUsageStats[] = planStatsResult.rows.map((row) => ({
            planSlug: String(row.plan_slug),
            planName: String(row.plan_name),
            customerCount: Number(row.customer_count),
            averageUsage: {}
        }));

        const stats: SystemUsageStats = {
            totalCustomers: Number(customersResult.rows[0]?.count || 0),
            customersByCategory,
            planStats,
            topLimits: []
        };

        apiLogger.debug({ stats }, 'System usage stats calculated');

        return { success: true, data: stats };
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            },
            'Failed to get system usage stats'
        );
        const errorMessage =
            process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
                ? `Failed to get system usage stats: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get system usage stats';
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: errorMessage
            }
        };
    }
}

/**
 * Get customers whose usage is approaching or exceeding a given threshold.
 *
 * Queries `billing_customer_limits` joined with `billing_customers` and
 * calculates the usage percentage as `current_value / max_value * 100`.
 * Only records where `max_value > 0` are considered to avoid division by zero.
 * Results are ordered by descending usage percentage.
 *
 * @param threshold - Minimum usage percentage to include (1-100, default 90)
 * @param livemode - Whether to fetch live or test mode data (default: true)
 * @returns List of customer limit items at or above the threshold
 */
export async function getApproachingLimits(
    threshold = 90,
    livemode = true
): Promise<ServiceResult<ApproachingLimitItem[]>> {
    try {
        const db = getDb();

        const result = await db.execute(sql`
            SELECT
                cl.customer_id,
                c.email AS customer_email,
                cl.limit_key,
                cl.current_value,
                cl.max_value,
                ROUND(
                    (cl.current_value::numeric / cl.max_value::numeric) * 100,
                    2
                ) AS usage_percentage
            FROM billing_customer_limits cl
            JOIN billing_customers c ON cl.customer_id = c.id
            WHERE cl.livemode = ${livemode}
            AND c.livemode = ${livemode}
            AND c.deleted_at IS NULL
            AND cl.max_value > 0
            AND (cl.current_value::numeric / cl.max_value::numeric) * 100 >= ${threshold}
            ORDER BY usage_percentage DESC, cl.customer_id ASC
        `);

        const items: ApproachingLimitItem[] = result.rows.map((row) => ({
            customerId: String(row.customer_id),
            customerEmail: String(row.customer_email),
            limitKey: String(row.limit_key),
            currentUsage: Number(row.current_value),
            maxAllowed: Number(row.max_value),
            usagePercentage: Math.round(Number(row.usage_percentage) * 100) / 100
        }));

        apiLogger.debug(
            { threshold, livemode, itemCount: items.length },
            'Approaching limits retrieved'
        );

        return { success: true, data: items };
    } catch (error) {
        apiLogger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'Failed to get approaching limits'
        );
        const errorMessage =
            process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
                ? `Failed to get approaching limits: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get approaching limits';
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: errorMessage
            }
        };
    }
}
