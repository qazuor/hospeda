/**
 * Public get event summary endpoint
 * Returns event summary
 */
import { EventIdSchema, EventSummarySchema, type ServiceErrorCode } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/:id/summary
 * Get event summary - Public endpoint
 */
export const publicGetEventSummaryRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get event summary',
    description: 'Retrieve a summary for a specific event',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventSummarySchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const id = params.id as string;
        const validation = EventIdSchema.safeParse(id);
        if (!validation.success) throw validation.error;
        const actor = getActorFromContext(ctx);
        const result = await eventService.getSummary(actor, { eventId: id });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data ?? null;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
