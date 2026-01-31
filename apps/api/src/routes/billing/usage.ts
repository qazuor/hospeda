/**
 * Usage Tracking API Routes
 *
 * Provides endpoints for users to view their current usage against plan limits.
 * Helps users understand how much of their plan they've consumed and when they need to upgrade.
 *
 * Routes:
 * - GET /api/v1/billing/usage - Get complete usage summary for current user
 * - GET /api/v1/billing/usage/:limitKey - Get detailed usage for a specific limit
 *
 * @module routes/billing/usage
 */

import { LimitKey } from '@repo/billing';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../middlewares/billing';
import { UsageTrackingService } from '../../services/usage-tracking.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

/**
 * Usage summary response schema
 */
const limitUsageSchema = z.object({
    limitKey: z.string(),
    displayName: z.string(),
    currentUsage: z.number(),
    maxAllowed: z.number(),
    usagePercentage: z.number(),
    threshold: z.enum(['ok', 'warning', 'critical', 'exceeded']),
    planBaseLimit: z.number(),
    addonBonusLimit: z.number()
});

const usageSummarySchema = z.object({
    customerId: z.string(),
    limits: z.array(limitUsageSchema),
    overallThreshold: z.enum(['ok', 'warning', 'critical', 'exceeded']),
    upgradeUrl: z.string()
});

/**
 * Limit key path parameter schema
 */
const limitKeyParamSchema = z.object({
    limitKey: z.nativeEnum(LimitKey)
});

/**
 * GET /api/v1/billing/usage
 * Get current user's usage summary across all limits
 */
export const getUserUsageSummaryRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'Get usage summary',
    description:
        "Returns current user's resource usage across all plan limits with threshold status",
    tags: ['Billing', 'Usage'],
    responseSchema: usageSummarySchema,
    handler: async (c) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        // Get billing customer ID from context (set by billing customer middleware)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(400, {
                message: 'No billing customer found for current user'
            });
        }

        // Get QZPay billing instance
        const billing = getQZPayBilling();

        if (!billing) {
            throw new HTTPException(503, {
                message: 'Billing service is unavailable'
            });
        }

        // Create usage tracking service
        const usageTrackingService = new UsageTrackingService(billing);

        // Get usage summary
        const result = await usageTrackingService.getUsageSummary(billingCustomerId);

        if (!result.success || !result.data) {
            const errorMessage = result.error?.message || 'Failed to get usage summary';
            apiLogger.error(
                {
                    customerId: billingCustomerId,
                    error: result.error
                },
                'Failed to get usage summary via API'
            );

            throw new HTTPException(500, {
                message: errorMessage
            });
        }

        apiLogger.debug(
            {
                customerId: billingCustomerId,
                overallThreshold: result.data.overallThreshold
            },
            'Usage summary retrieved via API'
        );

        return result.data;
    }
});

/**
 * GET /api/v1/billing/usage/:limitKey
 * Get detailed usage for a specific limit
 */
export const getUsageForLimitRoute = createProtectedRoute({
    method: 'get',
    path: '/{limitKey}',
    summary: 'Get usage for specific limit',
    description:
        'Returns detailed usage information for a specific resource limit including plan base and add-on bonuses',
    tags: ['Billing', 'Usage'],
    requestParams: limitKeyParamSchema.shape,
    responseSchema: limitUsageSchema,
    handler: async (c, params) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        // Get billing customer ID from context
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(400, {
                message: 'No billing customer found for current user'
            });
        }

        // Get QZPay billing instance
        const billing = getQZPayBilling();

        if (!billing) {
            throw new HTTPException(503, {
                message: 'Billing service is unavailable'
            });
        }

        // Validate limit key from params
        const { limitKey } = params;

        // Create usage tracking service
        const usageTrackingService = new UsageTrackingService(billing);

        // Get usage for specific limit
        const result = await usageTrackingService.getUsageForLimit(
            billingCustomerId,
            limitKey as string
        );

        if (!result.success) {
            const errorMessage = result.error?.message || 'Failed to get limit usage';
            apiLogger.error(
                {
                    customerId: billingCustomerId,
                    limitKey,
                    error: result.error
                },
                'Failed to get limit usage via API'
            );

            throw new HTTPException(500, {
                message: errorMessage
            });
        }

        // Handle case where limit usage is null (customer not found or no subscription)
        if (!result.data) {
            throw new HTTPException(404, {
                message: `No usage data found for limit ${limitKey}`
            });
        }

        apiLogger.debug(
            {
                customerId: billingCustomerId,
                limitKey,
                threshold: result.data.threshold
            },
            'Limit usage retrieved via API'
        );

        return result.data;
    }
});

/**
 * Usage routes router
 */
const usageRouter = createRouter();

usageRouter.route('/', getUserUsageSummaryRoute);
usageRouter.route('/', getUsageForLimitRoute);

export default usageRouter;
