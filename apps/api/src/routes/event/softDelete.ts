import { EventIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Protected route: Soft delete event
 *
 * Performs a soft delete on the specified event using `EventService.softDelete`.
 * Returns an echo object with the `id` on success.
 *
 * - Method: DELETE
 * - Path: `/{id}`
 * - Params: `id` (EventId)
 * - Response: `{ id: EventId }`
 */
export const softDeleteEventRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event',
    description: 'Soft deletes an event by ID',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventService.softDelete(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
