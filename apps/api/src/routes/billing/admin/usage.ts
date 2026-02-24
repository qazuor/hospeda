/**
 * Admin Usage Tracking API Routes
 *
 * Provides admin endpoints to view usage tracking for any customer.
 * These routes require admin permissions.
 *
 * Routes:
 * - GET /api/v1/admin/billing/usage/:customerId - Get usage summary for any customer
 *
 * @module routes/billing/admin/usage
 */

import { PermissionEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import { UsageTrackingService } from '../../../services/usage-tracking.service';
import type { AppBindings } from '../../../types';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

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
 * Customer ID path parameter schema
 */
const customerIdParamSchema = z.object({
    customerId: z.string()
});

/**
 * Handler for getting customer usage summary
 * Extracted for testing purposes
 */
export const getAdminCustomerUsageSummaryHandler = async (
    c: Context<AppBindings>,
    params: Record<string, unknown>
) => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        throw new HTTPException(503, {
            message: 'Billing service is not configured'
        });
    }

    // Get customer ID from path params
    const { customerId } = params;

    // Get QZPay billing instance
    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is unavailable'
        });
    }

    // Create usage tracking service
    const usageTrackingService = new UsageTrackingService(billing);

    // Get usage summary for specified customer
    const result = await usageTrackingService.getUsageSummary(customerId as string);

    if (!result.success || !result.data) {
        const errorMessage = result.error?.message || 'Failed to get usage summary';
        apiLogger.error(
            {
                customerId,
                error: result.error
            },
            'Admin failed to get customer usage summary via API'
        );

        throw new HTTPException(500, {
            message: errorMessage
        });
    }

    apiLogger.debug(
        {
            customerId,
            overallThreshold: result.data.overallThreshold
        },
        'Admin retrieved customer usage summary via API'
    );

    return result.data;
};

/**
 * GET /api/v1/admin/billing/usage/:customerId
 * Get usage summary for any customer (admin only)
 */
export const getAdminCustomerUsageSummaryRoute = createAdminRoute({
    method: 'get',
    path: '/{customerId}',
    summary: 'Get customer usage summary',
    description:
        "Returns any customer's resource usage across all plan limits with threshold status",
    tags: ['Billing', 'Usage'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: customerIdParamSchema.shape,
    responseSchema: usageSummarySchema,
    handler: getAdminCustomerUsageSummaryHandler
});
