/**
 * Billing Metrics Routes
 *
 * REST API routes for billing analytics and metrics.
 * Provides endpoints for:
 * - Dashboard overview metrics (admin only)
 * - Recent subscription activity (admin only)
 *
 * All routes are mounted under /api/v1/billing/metrics
 *
 * @module routes/billing/metrics
 */

import { z } from 'zod';
import { BillingMetricsService } from '../../services/billing-metrics.service';
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
 * GET /api/v1/billing/metrics
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
        const service = new BillingMetricsService();
        const livemode = query?.livemode === 'true';
        const months = (query?.months as number) ?? 12;

        apiLogger.debug('Fetching dashboard metrics');

        // Fetch all metrics in parallel
        const [overviewResult, revenueResult, breakdownResult] = await Promise.all([
            service.getOverviewMetrics(livemode),
            service.getRevenueTimeSeries(months, livemode),
            service.getSubscriptionBreakdown(livemode)
        ]);

        // Check for errors
        if (!overviewResult.success || !overviewResult.data) {
            throw new Error(overviewResult.error?.message ?? 'Failed to fetch overview metrics');
        }

        if (!revenueResult.success || !revenueResult.data) {
            throw new Error(revenueResult.error?.message ?? 'Failed to fetch revenue time series');
        }

        if (!breakdownResult.success || !breakdownResult.data) {
            throw new Error(
                breakdownResult.error?.message ?? 'Failed to fetch subscription breakdown'
            );
        }

        return {
            overview: overviewResult.data,
            revenueTimeSeries: revenueResult.data,
            subscriptionBreakdown: breakdownResult.data
        };
    }
});

/**
 * Get recent subscription activity (admin only)
 *
 * GET /api/v1/billing/metrics/activity
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
        const service = new BillingMetricsService();
        const livemode = query?.livemode === 'true';
        const limit = (query?.limit as number) ?? 20;

        apiLogger.debug('Fetching recent activity');

        const result = await service.getRecentActivity(limit, livemode);

        if (!result.success || !result.data) {
            throw new Error(result.error?.message ?? 'Failed to fetch recent activity');
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

export default metricsRouter;
