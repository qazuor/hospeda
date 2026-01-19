import { EventLocationCreateInputSchema, EventLocationSchema } from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

export const createEventLocationRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create event location',
    description: 'Creates a new event location',
    tags: ['Event Locations'],
    requestBody: EventLocationCreateInputSchema,
    responseSchema: EventLocationSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.create(actor, body as never);
        if (result.error) throw result.error;
        return result.data;
    }
});
