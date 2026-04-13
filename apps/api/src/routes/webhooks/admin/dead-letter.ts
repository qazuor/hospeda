/**
 * Admin Webhook Dead Letter Queue API Routes
 *
 * Provides admin endpoints to view and manage webhook dead letter queue entries.
 * These routes require admin permissions.
 *
 * Routes:
 * - GET /api/v1/admin/webhooks/dead-letter - List dead letter queue entries
 * - POST /api/v1/admin/webhooks/dead-letter/:id/retry - Retry a dead letter event
 *
 * @module routes/webhooks/admin/dead-letter
 */

import {
    and,
    billingWebhookDeadLetter,
    billingWebhookEvents,
    count,
    desc,
    eq,
    getDb,
    gte,
    isNotNull,
    isNull,
    lte,
    withTransaction
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
    DeadLetterQueueListResponseSchema,
    DeadLetterRetryResponseSchema,
    ListDeadLetterQueueQuerySchema
} from '../../../schemas';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Dead letter ID path parameter schema
 */
const deadLetterIdParamSchema = z.object({
    id: z.string().uuid()
});

/**
 * GET /api/v1/admin/webhooks/dead-letter
 * List dead letter queue entries with filtering (admin only)
 */
export const listDeadLetterQueueRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List dead letter queue entries',
    description:
        'Returns paginated list of webhook dead letter queue entries with optional filtering',
    tags: ['Webhooks'],
    requiredPermissions: [PermissionEnum.ACCESS_API_ADMIN],
    requestQuery: ListDeadLetterQueueQuerySchema.shape,
    responseSchema: DeadLetterQueueListResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const db = getDb();

        try {
            // Build filter conditions
            const conditions: ReturnType<typeof eq>[] = [];

            if (query?.provider) {
                conditions.push(eq(billingWebhookDeadLetter.provider, query.provider as string));
            }

            if (query?.type) {
                conditions.push(eq(billingWebhookDeadLetter.type, query.type as string));
            }

            if (query?.livemode !== undefined) {
                conditions.push(eq(billingWebhookDeadLetter.livemode, query.livemode as boolean));
            }

            // Filter by resolved status
            if (query?.resolved === true) {
                conditions.push(isNotNull(billingWebhookDeadLetter.resolvedAt));
            } else if (query?.resolved === false) {
                conditions.push(isNull(billingWebhookDeadLetter.resolvedAt));
            }

            if (query?.startDate) {
                conditions.push(
                    gte(billingWebhookDeadLetter.createdAt, new Date(query.startDate as string))
                );
            }

            if (query?.endDate) {
                conditions.push(
                    lte(billingWebhookDeadLetter.createdAt, new Date(query.endDate as string))
                );
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count
            const countResult = await db
                .select({ total: count() })
                .from(billingWebhookDeadLetter)
                .where(whereClause);

            const total = countResult[0]?.total ?? 0;

            // Get paginated results
            const limit: number = Number(query?.limit ?? 50);
            const offset: number = Number(query?.offset ?? 0);

            const results = await db
                .select({
                    id: billingWebhookDeadLetter.id,
                    providerEventId: billingWebhookDeadLetter.providerEventId,
                    provider: billingWebhookDeadLetter.provider,
                    type: billingWebhookDeadLetter.type,
                    payload: billingWebhookDeadLetter.payload,
                    error: billingWebhookDeadLetter.error,
                    attempts: billingWebhookDeadLetter.attempts,
                    resolvedAt: billingWebhookDeadLetter.resolvedAt,
                    livemode: billingWebhookDeadLetter.livemode,
                    createdAt: billingWebhookDeadLetter.createdAt
                })
                .from(billingWebhookDeadLetter)
                .where(whereClause)
                .orderBy(desc(billingWebhookDeadLetter.createdAt))
                .limit(limit)
                .offset(offset);

            apiLogger.debug(
                {
                    total,
                    returned: results.length,
                    filters: {
                        provider: query?.provider,
                        type: query?.type,
                        resolved: query?.resolved
                    }
                },
                'Admin retrieved dead letter queue entries via API'
            );

            return {
                data: results.map((row) => ({
                    id: row.id,
                    providerEventId: row.providerEventId,
                    provider: row.provider,
                    type: row.type,
                    payload: row.payload,
                    error: row.error,
                    attempts: row.attempts,
                    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
                    livemode: row.livemode,
                    createdAt: row.createdAt.toISOString()
                })),
                total: Number(total),
                limit,
                offset
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    filters: query
                },
                'Admin failed to retrieve dead letter queue entries via API'
            );

            throw new HTTPException(500, {
                message: 'Failed to retrieve dead letter queue entries'
            });
        }
    }
});

/**
 * POST /api/v1/admin/webhooks/dead-letter/:id/retry
 * Manually retry a dead letter queue entry (admin only)
 */
export const retryDeadLetterRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/retry',
    summary: 'Retry dead letter queue entry',
    description: 'Manually retry processing a webhook event from the dead letter queue',
    tags: ['Webhooks'],
    requiredPermissions: [PermissionEnum.ACCESS_API_ADMIN],
    requestParams: deadLetterIdParamSchema.shape,
    responseSchema: DeadLetterRetryResponseSchema,
    handler: async (_c, params) => {
        const db = getDb();
        const deadLetterId = params.id as string;

        try {
            // Fetch the dead letter entry first (read-only guard checks outside the transaction
            // to avoid holding a connection open during validation logic).
            const [deadLetterEntry] = await db
                .select({
                    id: billingWebhookDeadLetter.id,
                    providerEventId: billingWebhookDeadLetter.providerEventId,
                    provider: billingWebhookDeadLetter.provider,
                    type: billingWebhookDeadLetter.type,
                    payload: billingWebhookDeadLetter.payload,
                    resolvedAt: billingWebhookDeadLetter.resolvedAt,
                    livemode: billingWebhookDeadLetter.livemode
                })
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            if (!deadLetterEntry) {
                throw new HTTPException(404, {
                    message: 'Dead letter entry not found'
                });
            }

            // Check if already resolved
            if (deadLetterEntry.resolvedAt) {
                throw new HTTPException(400, {
                    message: 'Dead letter entry has already been resolved'
                });
            }

            // Atomically insert the new webhook event and mark the dead letter entry as resolved.
            // Both writes must succeed together: inserting the event without resolving the dead
            // letter entry would allow duplicate retries; resolving without inserting would
            // silently discard the retry request.
            const newEvent = await withTransaction(async (tx) => {
                const newEventResult = await tx
                    .insert(billingWebhookEvents)
                    .values({
                        providerEventId: deadLetterEntry.providerEventId,
                        provider: deadLetterEntry.provider,
                        type: deadLetterEntry.type,
                        status: 'pending',
                        payload: deadLetterEntry.payload,
                        attempts: 0,
                        livemode: deadLetterEntry.livemode
                    })
                    .returning({
                        id: billingWebhookEvents.id
                    });

                const inserted = newEventResult[0];
                if (!inserted) {
                    throw new HTTPException(500, {
                        message: 'Failed to create new webhook event'
                    });
                }

                await tx
                    .update(billingWebhookDeadLetter)
                    .set({ resolvedAt: new Date() })
                    .where(eq(billingWebhookDeadLetter.id, deadLetterId));

                return inserted;
            });

            apiLogger.info(
                {
                    deadLetterId,
                    newEventId: newEvent.id,
                    provider: deadLetterEntry.provider,
                    type: deadLetterEntry.type
                },
                'Admin retried dead letter queue entry via API'
            );

            return {
                success: true,
                message: 'Dead letter entry has been queued for retry',
                eventId: newEvent.id
            };
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                {
                    deadLetterId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                'Admin failed to retry dead letter queue entry via API'
            );

            throw new HTTPException(500, {
                message: 'Failed to retry dead letter queue entry'
            });
        }
    }
});
