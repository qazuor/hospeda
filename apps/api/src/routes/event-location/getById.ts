import { EventLocationIdSchema, EventLocationSchema } from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

export const eventLocationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event location by ID',
    description: 'Retrieves an event location by its ID',
    tags: ['Event Locations'],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: EventLocationSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.getById(actor, params.id as string);
        if (result.error) throw result.error;
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
