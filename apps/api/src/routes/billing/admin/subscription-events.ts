/**
 * Admin API route for subscription lifecycle events.
 *
 * Provides paginated access to the audit trail of subscription
 * state transitions for admin dashboard display.
 *
 * Routes:
 * - GET /api/v1/admin/billing/subscriptions/:id/events
 *
 * @module routes/billing/admin/subscription-events
 */

import { billingSubscriptionEvents, getDb } from '@repo/db';
import { PermissionEnum, SubscriptionEventsResponseSchema } from '@repo/schemas';
import { count, desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
    ListSubscriptionEventsQuerySchema,
    SubscriptionEventsParamSchema
} from '../../../schemas/subscription-events.schema';
import type { AppBindings } from '../../../types';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Handler for listing subscription lifecycle events.
 * Extracted for testing purposes.
 *
 * @param c - Hono context with AppBindings
 * @param params - Path parameters containing the subscription ID
 * @param _body - Unused request body
 * @param query - Validated query parameters (page, pageSize)
 * @returns Paginated list of subscription events with pagination metadata
 */
export const listSubscriptionEventsHandler = async (
    _c: Context<AppBindings>,
    params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
) => {
    // No BillingSubscriptionEventService exists in @repo/service-core that provides
    // paginated read access to the billing_subscription_events table. This is a
    // read-only admin diagnostic endpoint with no write operations or business logic,
    // so direct DB access is appropriate here.
    const db = getDb();

    const { id: subscriptionId } = params as { id: string };
    const { page = 1, pageSize = 10 } = (query ?? {}) as { page?: number; pageSize?: number };

    const offset = (page - 1) * pageSize;

    try {
        const [events, countResult] = await Promise.all([
            db
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId))
                .orderBy(desc(billingSubscriptionEvents.createdAt))
                .limit(pageSize)
                .offset(offset),
            db
                .select({ count: count() })
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId))
        ]);

        const totalItems = Number(countResult[0]?.count ?? 0);
        const totalPages = Math.ceil(totalItems / pageSize);

        apiLogger.debug(
            {
                subscriptionId,
                page,
                pageSize,
                totalItems,
                returned: events.length
            },
            'Admin retrieved subscription events via API'
        );

        return {
            data: events.map((e) => ({
                id: e.id,
                subscriptionId: e.subscriptionId,
                previousStatus: e.previousStatus,
                newStatus: e.newStatus,
                triggerSource: e.triggerSource,
                providerEventId: e.providerEventId ?? null,
                metadata: (e.metadata as Record<string, unknown>) ?? {},
                createdAt: e.createdAt.toISOString()
            })),
            pagination: {
                page,
                pageSize,
                totalItems,
                totalPages
            }
        };
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            'Admin failed to retrieve subscription events via API'
        );

        throw new HTTPException(500, {
            message: 'Failed to retrieve subscription events'
        });
    }
};

/**
 * GET /api/v1/admin/billing/subscriptions/:id/events
 * List lifecycle events for a subscription (admin only, paginated)
 */
export const subscriptionEventsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/events',
    summary: 'List subscription lifecycle events',
    description:
        'Returns paginated audit trail of status transitions for a specific subscription. Ordered most-recent first.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: SubscriptionEventsParamSchema.shape,
    requestQuery: ListSubscriptionEventsQuerySchema.shape,
    responseSchema: SubscriptionEventsResponseSchema,
    handler: listSubscriptionEventsHandler
});
