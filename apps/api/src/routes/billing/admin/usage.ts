/**
 * Admin Usage Tracking API Routes
 *
 * Provides admin endpoints to view usage tracking for any customer.
 * These routes require admin permissions.
 *
 * Routes:
 * - GET /api/v1/admin/billing/usage/:customerId - Get usage summary for any customer
 *
 * ## Product-domain scoping (HOS-1288)
 *
 * A billing customer can hold one subscription per vertical, so "the"
 * customer's usage is not a question with one answer. The protected
 * (self-service) twin of this route has taken `?productDomain=` since HOS-259;
 * this one did not, and called `getUsageSummary(customerId)` with no domain —
 * falling to the parameter's `'accommodation'` default. For a customer who has
 * only a gastronomy or experience subscription that is not merely the wrong
 * answer: it is unanswerable, and the route reported it as HTTP 500, which
 * reads as an outage rather than as staff asking for the wrong vertical.
 *
 * @module routes/billing/admin/usage
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    ProductDomainQuerySchema,
    type ProductDomainScope
} from '../../../schemas/product-domain-query.schema';
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
 *
 * @param c - Hono context.
 * @param params - Validated path params (`customerId`).
 * @param _body - Unused; GET carries no body.
 * @param query - Validated query params. `productDomain` selects which of the
 *   customer's subscriptions to report on, defaulting to `'accommodation'` so
 *   every pre-existing caller is unchanged (HOS-1288).
 */
export const getAdminCustomerUsageSummaryHandler = async (
    c: Context<AppBindings>,
    params: Record<string, unknown>,
    _body?: unknown,
    query?: Record<string, unknown>
) => {
    const requestedProductDomain = query?.productDomain as ProductDomainScope | undefined;
    const productDomain: ProductDomainScope = requestedProductDomain ?? 'accommodation';
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

    // Get usage summary for specified customer, scoped to the requested domain
    const result = await usageTrackingService.getUsageSummary(customerId as string, productDomain);

    if (!result.success || !result.data) {
        const errorMessage = result.error?.message || 'Failed to get usage summary';

        // HOS-1288: "this customer holds no subscription in the domain you
        // asked about" is an expected answer, not a server fault — the same
        // reasoning the protected twin already applies. Reporting it as 500
        // made every free account, and every customer whose only subscription
        // is in another vertical, look like an outage. Per the API error
        // contract a 4xx is never INTERNAL_ERROR.
        if (result.error?.code === ServiceErrorCode.NOT_FOUND) {
            apiLogger.debug(
                { customerId, productDomain },
                'Admin usage summary: customer has no subscription in the requested product domain'
            );

            throw new HTTPException(404, { message: errorMessage });
        }

        apiLogger.error(
            {
                customerId,
                productDomain,
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
            productDomain,
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
        "Returns any customer's resource usage across all plan limits with threshold status, " +
        'scoped to one product domain (`?productDomain=`, default `accommodation`). Answers 404 ' +
        'when the customer holds no subscription in that domain.',
    tags: ['Billing', 'Usage'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: customerIdParamSchema.shape,
    requestQuery: ProductDomainQuerySchema.shape,
    responseSchema: usageSummarySchema,
    handler: getAdminCustomerUsageSummaryHandler
});
