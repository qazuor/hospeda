/**
 * Admin Webhook Events API Routes
 *
 * Provides admin endpoints to view and manage webhook events.
 * These routes require admin permissions.
 *
 * Routes:
 * - GET /api/v1/admin/webhooks/events - List webhook events with filtering
 *
 * @module routes/webhooks/admin/events
 */

import { billingWebhookEvents, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { type SQL, and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { ListWebhookEventsQuerySchema, WebhookEventsListResponseSchema } from '../../../schemas';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/webhooks/events
 * List webhook events with filtering (admin only)
 */
export const listWebhookEventsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List webhook events',
    description:
        'Returns paginated list of webhook events with optional filtering by status, type, provider, and date range',
    tags: ['Webhooks'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: ListWebhookEventsQuerySchema.shape,
    responseSchema: WebhookEventsListResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const db = getDb();

        try {
            // Build filter conditions
            const conditions: SQL[] = [];

            if (query?.status) {
                conditions.push(
                    eq(
                        billingWebhookEvents.status,
                        query.status as typeof billingWebhookEvents.status.dataType
                    )
                );
            }

            if (query?.type) {
                conditions.push(
                    eq(
                        billingWebhookEvents.type,
                        query.type as typeof billingWebhookEvents.type.dataType
                    )
                );
            }

            if (query?.provider) {
                conditions.push(
                    eq(
                        billingWebhookEvents.provider,
                        query.provider as typeof billingWebhookEvents.provider.dataType
                    )
                );
            }

            if (query?.livemode !== undefined) {
                const livemodeValue = query.livemode === 'true';
                conditions.push(eq(billingWebhookEvents.livemode, livemodeValue));
            }

            if (query?.startDate) {
                const startDate = new Date(query.startDate as string);
                conditions.push(gte(billingWebhookEvents.createdAt, startDate));
            }

            if (query?.endDate) {
                const endDate = new Date(query.endDate as string);
                conditions.push(lte(billingWebhookEvents.createdAt, endDate));
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count
            const totalResult = await db
                .select({ total: count() })
                .from(billingWebhookEvents)
                .where(whereClause);

            const total = totalResult[0]?.total ?? 0;

            // Get paginated results
            const results = await db
                .select({
                    id: billingWebhookEvents.id,
                    providerEventId: billingWebhookEvents.providerEventId,
                    provider: billingWebhookEvents.provider,
                    type: billingWebhookEvents.type,
                    status: billingWebhookEvents.status,
                    payload: billingWebhookEvents.payload,
                    processedAt: billingWebhookEvents.processedAt,
                    error: billingWebhookEvents.error,
                    attempts: billingWebhookEvents.attempts,
                    livemode: billingWebhookEvents.livemode,
                    createdAt: billingWebhookEvents.createdAt
                })
                .from(billingWebhookEvents)
                .where(whereClause)
                .orderBy(desc(billingWebhookEvents.createdAt))
                .limit((query?.limit ?? 50) as number)
                .offset((query?.offset ?? 0) as number);

            apiLogger.debug(
                {
                    total,
                    returned: results.length,
                    filters: {
                        status: query?.status,
                        type: query?.type,
                        provider: query?.provider
                    }
                },
                'Admin retrieved webhook events via API'
            );

            return {
                data: results.map((row) => ({
                    id: row.id,
                    providerEventId: row.providerEventId,
                    provider: row.provider,
                    type: row.type,
                    status: row.status,
                    payload: row.payload,
                    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
                    error: row.error,
                    attempts: row.attempts,
                    livemode: row.livemode,
                    createdAt: row.createdAt.toISOString()
                })),
                total: Number(total),
                limit: query?.limit ?? 50,
                offset: query?.offset ?? 0
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    filters: query
                },
                'Admin failed to retrieve webhook events via API'
            );

            throw new HTTPException(500, {
                message: 'Failed to retrieve webhook events'
            });
        }
    }
});
