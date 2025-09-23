import { EventCreateInputSchema, EventSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Protected route: Create event
 *
 * Creates a new event using the `EventService.create` method.
 * Requires an authenticated actor and a valid `EventCreateSchema` payload.
 *
 * - Method: POST
 * - Path: `/`
 * - Body: `EventCreateInputSchema`
 * - Response: `EventSchema`
 */
export const createEventRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create event',
    description: 'Creates a new event',
    tags: ['Events'],
    requestBody: EventCreateInputSchema,
    responseSchema: EventSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.create(actor, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
