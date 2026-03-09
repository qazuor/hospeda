/**
 * Billing Metrics Routes
 *
 * REST API routes for billing analytics and metrics.
 * Provides endpoints for:
 * - Dashboard overview metrics (admin only)
 * - Recent subscription activity (admin only)
 *
 * All routes are mounted under /api/v1/protected/billing/metrics
 *
 * @module routes/billing/metrics
 */

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getBillingMetricsService } from '../../services/billing-metrics.service';
import { getApproachingLimits, getSystemUsage } from '../../services/billing-usage.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/**
 * Response schema for overview metrics
 */
const OverviewMetricsResponseSchema = z.object({
    mrr: z.number().describe('Monthly Recurring Revenue'),
    activeSubscriptions: z.number().describe('Active subscriptions count'),
    trialingSubscriptions: z.number().describe('Trialing subscriptions count'),
    churnRate: z.number().describe('Churn rate percentage'),
    arpu: z.number().describe('Average Revenue Per User'),
    trialConversionRate: z.number().describe('Trial conversion rate percentage'),
    totalCustomers: z.number().describe('Total customers count'),
    totalRevenue: z.number().describe('Total revenue (all-time)')
});

/**
 * Response schema for revenue data point
 */
const RevenueDataPointSchema = z.object({
    month: z.string().describe('Month in YYYY-MM format'),
    revenue: z.number().describe('Revenue for the month'),
    paymentCount: z.number().describe('Number of payments in the month')
});

/**
 * Response schema for recent activity
 */
const RecentActivityItemSchema = z.object({
    subscriptionId: z.string().uuid().describe('Subscription ID'),
    customerEmail: z.string().email().describe('Customer email'),
    status: z.string().describe('Subscription status'),
    planId: z.string().describe('Plan ID'),
    updatedAt: z.string().datetime().describe('Last updated timestamp')
});

/**
 * Response schema for plan breakdown
 */
const PlanBreakdownSchema = z.object({
    planId: z.string().describe('Plan ID'),
    activeCount: z.number().describe('Active subscriptions count'),
    trialingCount: z.number().describe('Trialing subscriptions count')
});

/**
 * Response schema for dashboard metrics
 */
const DashboardMetricsResponseSchema = z.object({
    overview: OverviewMetricsResponseSchema,
    revenueTimeSeries: z.array(RevenueDataPointSchema),
    subscriptionBreakdown: z.array(PlanBreakdownSchema)
});

/**
 * Query schema for metrics routes
 */
const MetricsQuerySchema = z.object({
    livemode: z
        .enum(['true', 'false'])
        .optional()
        .default('true')
        .describe('Whether to fetch live or test mode data'),
    months: z.coerce.number().min(1).max(24).optional().default(12).describe('Number of months')
});

/**
 * Query schema for activity route
 */
const ActivityQuerySchema = z.object({
    livemode: z
        .enum(['true', 'false'])
        .optional()
        .default('true')
        .describe('Whether to fetch live or test mode data'),
    limit: z.coerce.number().min(1).max(100).optional().default(20).describe('Maximum items')
});

/**
 * Get billing dashboard metrics (admin only)
 *
 * GET /api/v1/protected/billing/metrics
 */
export const getDashboardMetricsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Get billing dashboard metrics',
    description:
        'Returns complete dashboard metrics including overview, revenue time series, and subscription breakdown. Admin only.',
    tags: ['Billing - Metrics'],
    requestQuery: MetricsQuerySchema.shape,
    responseSchema: DashboardMetricsResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const service = getBillingMetricsService();
        const livemode = query?.livemode === 'true';
        const months = (query?.months as number) ?? 12;

        apiLogger.debug('Fetching dashboard metrics');

        // Fetch all metrics in parallel - use allSettled for resilience
        const [overviewResult, revenueResult, breakdownResult] = await Promise.allSettled([
            service.getOverviewMetrics(livemode),
            service.getRevenueTimeSeries(months, livemode),
            service.getSubscriptionBreakdown(livemode)
        ]);

        // Default fallback values
        const defaultOverview = {
            mrr: 0,
            activeSubscriptions: 0,
            trialingSubscriptions: 0,
            churnRate: 0,
            arpu: 0,
            trialConversionRate: 0,
            totalCustomers: 0,
            totalRevenue: 0
        };
        const defaultRevenue: Array<{
            month: string;
            revenue: number;
            paymentCount: number;
        }> = [];
        const defaultBreakdown: Array<{
            planId: string;
            activeCount: number;
            trialingCount: number;
        }> = [];

        // Extract overview metrics with fallback
        let overview = defaultOverview;
        if (overviewResult.status === 'fulfilled') {
            if (overviewResult.value.success && overviewResult.value.data) {
                overview = overviewResult.value.data;
            } else {
                apiLogger.warn(
                    { error: overviewResult.value.error?.message },
                    'Overview metrics failed'
                );
            }
        } else {
            apiLogger.warn({ reason: overviewResult.reason }, 'Overview metrics rejected');
        }

        // Extract revenue time series with fallback
        let revenueTimeSeries = defaultRevenue;
        if (revenueResult.status === 'fulfilled') {
            if (revenueResult.value.success && revenueResult.value.data) {
                revenueTimeSeries = revenueResult.value.data;
            } else {
                apiLogger.warn(
                    { error: revenueResult.value.error?.message },
                    'Revenue time series failed'
                );
            }
        } else {
            apiLogger.warn({ reason: revenueResult.reason }, 'Revenue time series rejected');
        }

        // Extract subscription breakdown with fallback
        let subscriptionBreakdown = defaultBreakdown;
        if (breakdownResult.status === 'fulfilled') {
            if (breakdownResult.value.success && breakdownResult.value.data) {
                subscriptionBreakdown = breakdownResult.value.data;
            } else {
                apiLogger.warn(
                    { error: breakdownResult.value.error?.message },
                    'Subscription breakdown failed'
                );
            }
        } else {
            apiLogger.warn({ reason: breakdownResult.reason }, 'Subscription breakdown rejected');
        }

        return {
            overview,
            revenueTimeSeries,
            subscriptionBreakdown
        };
    }
});

/**
 * Get recent subscription activity (admin only)
 *
 * GET /api/v1/protected/billing/metrics/activity
 */
export const getRecentActivityRoute = createAdminRoute({
    method: 'get',
    path: '/activity',
    summary: 'Get recent subscription activity',
    description: 'Returns recent subscription status changes. Admin only.',
    tags: ['Billing - Metrics'],
    requestQuery: ActivityQuerySchema.shape,
    responseSchema: z.array(RecentActivityItemSchema),
    handler: async (_c, _params, _body, query) => {
        const service = getBillingMetricsService();
        const livemode = query?.livemode === 'true';
        const limit = (query?.limit as number) ?? 20;

        apiLogger.debug('Fetching recent activity');

        const result = await service.getRecentActivity(limit, livemode);

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Failed to fetch recent activity'
            });
        }

        return result.data;
    }
});

/**
 * Response schema for system usage statistics
 */
const SystemUsageResponseSchema = z.object({
    totalCustomers: z.number().describe('Total billing customers count'),
    customersByCategory: z
        .record(z.string(), z.number())
        .describe('Customer counts grouped by category'),
    planStats: z
        .array(
            z.object({
                planSlug: z.string(),
                planName: z.string(),
                customerCount: z.number(),
                averageUsage: z.record(z.string(), z.number())
            })
        )
        .describe('Plan subscription statistics'),
    topLimits: z
        .array(
            z.object({
                limitKey: z.string(),
                limitName: z.string(),
                averageUsage: z.number(),
                customersAtCapacity: z.number()
            })
        )
        .describe('Top limits approaching capacity')
});

/**
 * Response schema for a single approaching-limit item
 */
const ApproachingLimitItemSchema = z.object({
    customerId: z.string().uuid().describe('Customer ID'),
    customerEmail: z.string().email().describe('Customer email'),
    limitKey: z.string().describe('Limit key identifier'),
    currentUsage: z.number().describe('Current usage value'),
    maxAllowed: z.number().describe('Maximum allowed value'),
    usagePercentage: z.number().describe('Usage as a percentage of the maximum (0-100)')
});

/**
 * Query schema for approaching-limits route
 */
const ApproachingLimitsQuerySchema = z.object({
    threshold: z.coerce
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(90)
        .describe('Minimum usage percentage threshold (1-100, default 90)'),
    livemode: z
        .enum(['true', 'false'])
        .optional()
        .default('true')
        .describe('Whether to fetch live or test mode data')
});

/**
 * Get system-wide usage statistics (admin only)
 *
 * GET /api/v1/protected/billing/metrics/system-usage
 */
export const getSystemUsageRoute = createAdminRoute({
    method: 'get',
    path: '/system-usage',
    summary: 'Get system-wide usage statistics',
    description:
        'Returns aggregated system usage statistics including customer counts, subscription states, revenue totals, and add-on purchase counts. Admin only.',
    tags: ['Billing - Metrics'],
    requestQuery: {
        livemode: z
            .enum(['true', 'false'])
            .optional()
            .default('true')
            .describe('Whether to fetch live or test mode data')
    },
    responseSchema: SystemUsageResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const livemode = query?.livemode === 'true';

        apiLogger.debug({ livemode }, 'Fetching system usage stats');

        const result = await getSystemUsage(livemode);

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Failed to fetch system usage stats'
            });
        }

        return result.data;
    }
});

/**
 * Get customers approaching their limits (admin only)
 *
 * GET /api/v1/protected/billing/metrics/approaching-limits
 */
export const getApproachingLimitsRoute = createAdminRoute({
    method: 'get',
    path: '/approaching-limits',
    summary: 'Get customers approaching their usage limits',
    description:
        'Returns a list of customers whose usage is at or above the specified threshold percentage. Useful for proactive capacity management. Admin only.',
    tags: ['Billing - Metrics'],
    requestQuery: ApproachingLimitsQuerySchema.shape,
    responseSchema: z.array(ApproachingLimitItemSchema),
    handler: async (_c, _params, _body, query) => {
        const livemode = query?.livemode === 'true';
        const threshold = (query?.threshold as number) ?? 90;

        apiLogger.debug({ threshold, livemode }, 'Fetching approaching limits');

        const result = await getApproachingLimits(threshold, livemode);

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Failed to fetch approaching limits'
            });
        }

        return result.data;
    }
});

/**
 * Billing metrics router
 *
 * Combines all metrics routes
 */
export const metricsRouter = createRouter();

// Mount all routes
metricsRouter.route('/', getDashboardMetricsRoute);
metricsRouter.route('/', getRecentActivityRoute);
metricsRouter.route('/', getSystemUsageRoute);
metricsRouter.route('/', getApproachingLimitsRoute);
