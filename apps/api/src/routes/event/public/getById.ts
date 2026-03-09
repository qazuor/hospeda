/**
 * Public get event by ID endpoint
 * Returns event details by unique identifier
 */
import { EventIdSchema, EventPublicSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/:id
 * Get event by ID - Public endpoint
 */
export const publicGetEventByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event by ID',
    description: 'Retrieves event details by unique identifier',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.getById(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
