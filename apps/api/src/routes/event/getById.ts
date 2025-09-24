import { EventIdSchema, EventSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

export const getEventByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event by ID',
    description: 'Retrieves event details by unique identifier',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
