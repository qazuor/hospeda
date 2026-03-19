/**
 * Billing Metrics Service
 *
 * Provides analytics and metrics for the billing system.
 * Aggregates data from subscriptions, payments, invoices, and customers
 * for dashboard and reporting purposes.
 *
 * Uses a singleton pattern to avoid per-request instantiation and includes
 * an in-memory cache with configurable TTL for dashboard overview queries.
 *
 * @module services/billing-metrics
 */

import { getDb, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import type { ServiceResult } from './addon.types';

export type { ServiceResult };

/** Cache entry with expiration timestamp */
interface CacheEntry<T> {
    readonly data: T;
    readonly expiresAt: number;
}

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Module-level singleton instance */
let instance: BillingMetricsService | null = null;

/**
 * Get the singleton instance of BillingMetricsService.
 *
 * Creates the instance on first call (lazy initialization).
 *
 * @returns The singleton BillingMetricsService instance
 */
export function getBillingMetricsService(): BillingMetricsService {
    if (!instance) {
        instance = new BillingMetricsService();
    }
    return instance;
}

/**
 * Reset the singleton instance and clear cache.
 * Intended for testing only.
 */
export function resetBillingMetricsService(): void {
    if (instance) {
        instance.clearCache();
    }
    instance = null;
}

/**
 * Overview metrics for billing dashboard
 */
export interface BillingOverviewMetrics {
    /** Monthly Recurring Revenue */
    mrr: number;
    /** Active subscriptions count */
    activeSubscriptions: number;
    /** Trialing subscriptions count */
    trialingSubscriptions: number;
    /** Churn rate (percentage) */
    churnRate: number;
    /** Average Revenue Per User */
    arpu: number;
    /** Trial to active conversion rate (percentage) */
    trialConversionRate: number;
    /** Total customers count */
    totalCustomers: number;
    /** Total revenue (all-time) */
    totalRevenue: number;
}

/**
 * Monthly revenue data point
 */
export interface RevenueDataPoint {
    /** Month in YYYY-MM format */
    month: string;
    /** Revenue for the month */
    revenue: number;
    /** Number of payments in the month */
    paymentCount: number;
}

/**
 * Recent subscription activity item
 */
export interface RecentActivityItem {
    /** Subscription ID */
    subscriptionId: string;
    /** Customer email */
    customerEmail: string;
    /** Subscription status */
    status: string;
    /** Plan ID */
    planId: string;
    /** Last updated timestamp */
    updatedAt: string;
}

/**
 * Subscription breakdown by plan
 */
export interface PlanBreakdown {
    /** Plan ID */
    planId: string;
    /** Active subscriptions count */
    activeCount: number;
    /** Trialing subscriptions count */
    trialingCount: number;
}

/**
 * Billing Metrics Service
 *
 * Handles all billing analytics and metrics calculations.
 * Uses in-memory caching for overview metrics to reduce database load.
 */
export class BillingMetricsService {
    private readonly overviewCache = new Map<string, CacheEntry<BillingOverviewMetrics>>();
    private readonly cacheTtlMs: number;

    /**
     * @param options - Configuration options
     * @param options.cacheTtlMs - Cache TTL in milliseconds (default: 5 minutes)
     */
    constructor({ cacheTtlMs }: { readonly cacheTtlMs?: number } = {}) {
        this.cacheTtlMs = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    }

    /**
     * Clear the overview metrics cache.
     */
    clearCache(): void {
        this.overviewCache.clear();
    }

    /**
     * Get overview metrics for dashboard.
     *
     * Results are cached with a configurable TTL (default: 5 minutes).
     * Cache is keyed by livemode to prevent mixing test/live data.
     *
     * @param livemode - Whether to fetch live or test mode data
     * @returns Overview metrics
     */
    async getOverviewMetrics(livemode = true): Promise<ServiceResult<BillingOverviewMetrics>> {
        // Check cache first
        const cacheKey = `overview:${String(livemode)}`;
        const cached = this.overviewCache.get(cacheKey);

        if (cached && Date.now() < cached.expiresAt) {
            apiLogger.debug({ cacheKey }, 'Returning cached overview metrics');
            return { success: true, data: cached.data };
        }

        try {
            const db = getDb();

            // Get active subscriptions count
            const activeSubsResult = await db.execute(sql`
                SELECT COUNT(*) as count
                FROM billing_subscriptions
                WHERE status = 'active'
                AND livemode = ${livemode}
                AND deleted_at IS NULL
            `);
            const activeSubscriptions = Number(activeSubsResult.rows[0]?.count || 0);

            // Get trialing subscriptions count
            const trialingSubsResult = await db.execute(sql`
                SELECT COUNT(*) as count
                FROM billing_subscriptions
                WHERE status = 'trialing'
                AND livemode = ${livemode}
                AND deleted_at IS NULL
            `);
            const trialingSubscriptions = Number(trialingSubsResult.rows[0]?.count || 0);

            // Calculate MRR from active subscriptions by joining with actual prices
            // For annual subscriptions, divide by 12 to get monthly equivalent
            const mrrResult = await db.execute(sql`
                SELECT COALESCE(SUM(
                    CASE
                        WHEN s.billing_interval = 'month' THEN p.unit_amount
                        WHEN s.billing_interval = 'year' THEN p.unit_amount / 12.0
                        ELSE 0
                    END
                ), 0) as mrr_total
                FROM billing_subscriptions s
                INNER JOIN billing_prices p ON s.plan_id = p.plan_id::text
                    AND s.billing_interval = p.billing_interval
                    AND p.livemode = s.livemode
                    AND p.active = true
                WHERE s.status = 'active'
                AND s.livemode = ${livemode}
                AND s.deleted_at IS NULL
            `);
            const mrr = Number(mrrResult.rows[0]?.mrr_total || 0);

            // Calculate churn rate (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const churnResult = await db.execute(sql`
                SELECT COUNT(*) as churned
                FROM billing_subscriptions
                WHERE status = 'canceled'
                AND canceled_at >= ${thirtyDaysAgo.toISOString()}
                AND livemode = ${livemode}
            `);
            const churnedCount = Number(churnResult.rows[0]?.churned || 0);
            const churnRate =
                activeSubscriptions > 0 ? (churnedCount / activeSubscriptions) * 100 : 0;

            // Calculate ARPU
            const arpu = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;

            // Calculate trial conversion rate
            // Using trial_converted column to track successful conversions from trial to paid
            const conversionResult = await db.execute(sql`
                SELECT
                    COUNT(*) FILTER (WHERE trial_converted = true) as converted,
                    COUNT(*) as total_trials
                FROM billing_subscriptions
                WHERE trial_start IS NOT NULL
                AND livemode = ${livemode}
            `);
            const converted = Number(conversionResult.rows[0]?.converted || 0);
            const totalTrials = Number(conversionResult.rows[0]?.total_trials || 0);
            const trialConversionRate = totalTrials > 0 ? (converted / totalTrials) * 100 : 0;

            // Get total customers
            const customersResult = await db.execute(sql`
                SELECT COUNT(*) as count
                FROM billing_customers
                WHERE livemode = ${livemode}
                AND deleted_at IS NULL
            `);
            const totalCustomers = Number(customersResult.rows[0]?.count || 0);

            // Get total revenue
            const revenueResult = await db.execute(sql`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM billing_payments
                WHERE status = 'completed'
                AND livemode = ${livemode}
            `);
            const totalRevenue = Number(revenueResult.rows[0]?.total || 0);

            const metrics: BillingOverviewMetrics = {
                mrr: Math.round(mrr),
                activeSubscriptions,
                trialingSubscriptions,
                churnRate: Math.round(churnRate * 100) / 100,
                arpu: Math.round(arpu),
                trialConversionRate: Math.round(trialConversionRate * 100) / 100,
                totalCustomers,
                totalRevenue: Math.round(totalRevenue)
            };

            apiLogger.debug({ metrics }, 'Overview metrics calculated');

            // Store in cache
            this.overviewCache.set(cacheKey, {
                data: metrics,
                expiresAt: Date.now() + this.cacheTtlMs
            });

            return {
                success: true,
                data: metrics
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'Failed to get overview metrics'
            );
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
                ? `Failed to get overview metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get overview metrics';
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
     * Get revenue time series data
     *
     * @param months - Number of months to retrieve (default: 12)
     * @param livemode - Whether to fetch live or test mode data
     * @returns Revenue data points by month
     */
    async getRevenueTimeSeries(
        months = 12,
        livemode = true
    ): Promise<ServiceResult<RevenueDataPoint[]>> {
        try {
            // Validate months is a positive integer within safe bounds
            const safeMonths = Math.max(1, Math.min(24, Math.floor(Number(months))));
            const db = getDb();

            const result = await db.execute(sql`
                SELECT
                    TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                    COALESCE(SUM(amount), 0) as revenue,
                    COUNT(*) as payment_count
                FROM billing_payments
                WHERE status = 'completed'
                AND livemode = ${livemode}
                AND created_at >= NOW() - make_interval(months => ${safeMonths})
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY DATE_TRUNC('month', created_at) ASC
            `);

            const dataPoints: RevenueDataPoint[] = result.rows.map((row) => ({
                month: String(row.month),
                revenue: Math.round(Number(row.revenue)),
                paymentCount: Number(row.payment_count)
            }));

            apiLogger.debug(
                {
                    months,
                    dataPoints: dataPoints.length
                },
                'Revenue time series calculated'
            );

            return {
                success: true,
                data: dataPoints
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'Failed to get revenue time series'
            );
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
                ? `Failed to get revenue time series: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get revenue time series';
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
     * Get recent subscription activity
     *
     * @param limit - Maximum number of items to return (default: 20)
     * @param livemode - Whether to fetch live or test mode data
     * @returns Recent activity items
     */
    async getRecentActivity(
        limit = 20,
        livemode = true
    ): Promise<ServiceResult<RecentActivityItem[]>> {
        try {
            const db = getDb();

            const result = await db.execute(sql`
                SELECT
                    s.id as subscription_id,
                    c.email as customer_email,
                    s.status,
                    s.plan_id,
                    s.updated_at
                FROM billing_subscriptions s
                JOIN billing_customers c ON s.customer_id = c.id
                WHERE s.livemode = ${livemode}
                AND s.deleted_at IS NULL
                ORDER BY s.updated_at DESC
                LIMIT ${limit}
            `);

            const activities: RecentActivityItem[] = result.rows.map((row) => ({
                subscriptionId: String(row.subscription_id),
                customerEmail: String(row.customer_email),
                status: String(row.status),
                planId: String(row.plan_id),
                updatedAt: new Date(row.updated_at as Date).toISOString()
            }));

            apiLogger.debug({ limit, activities: activities.length }, 'Recent activity retrieved');

            return {
                success: true,
                data: activities
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'Failed to get recent activity'
            );
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
                ? `Failed to get recent activity: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get recent activity';
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
     * Get subscription breakdown by plan
     *
     * @param livemode - Whether to fetch live or test mode data
     * @returns Plan breakdown data
     */
    async getSubscriptionBreakdown(livemode = true): Promise<ServiceResult<PlanBreakdown[]>> {
        try {
            const db = getDb();

            const result = await db.execute(sql`
                SELECT
                    plan_id,
                    COUNT(*) FILTER (WHERE status = 'active') as active_count,
                    COUNT(*) FILTER (WHERE status = 'trialing') as trialing_count
                FROM billing_subscriptions
                WHERE status IN ('active', 'trialing')
                AND livemode = ${livemode}
                AND deleted_at IS NULL
                GROUP BY plan_id
                ORDER BY active_count DESC
            `);

            const breakdown: PlanBreakdown[] = result.rows.map((row) => ({
                planId: String(row.plan_id),
                activeCount: Number(row.active_count || 0),
                trialingCount: Number(row.trialing_count || 0)
            }));

            apiLogger.debug({ breakdown: breakdown.length }, 'Subscription breakdown calculated');

            return {
                success: true,
                data: breakdown
            };
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'Failed to get subscription breakdown'
            );
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
                ? `Failed to get subscription breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`
                : 'Failed to get subscription breakdown';
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: errorMessage
                }
            };
        }
    }
}
