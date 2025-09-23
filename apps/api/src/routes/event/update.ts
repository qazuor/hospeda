import { EventIdSchema, EventSchema, EventUpdateInputSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Protected route: Update event
 *
 * Updates an existing event using `EventService.update`.
 * Requires an authenticated actor, `id` param, and a valid `EventUpdateSchema` body.
 *
 * - Method: PUT
 * - Path: `/{id}`
 * - Params: `id` (EventId)
 * - Body: `EventUpdateInputSchema`
 * - Response: `EventSchema`
 */
export const updateEventRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event',
    description: 'Updates an existing event',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    requestBody: EventUpdateInputSchema,
    responseSchema: EventSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventService.update(actor, id, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
