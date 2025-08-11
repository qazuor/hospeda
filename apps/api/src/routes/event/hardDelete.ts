import { EventIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Protected route: Hard delete event
 *
 * Permanently deletes the specified event using `EventService.hardDelete`.
 * Returns an echo object with the `id` on success.
 *
 * - Method: DELETE
 * - Path: `/{id}/hard`
 * - Params: `id` (EventId)
 * - Response: `{ id: EventId }`
 */
export const hardDeleteEventRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete event',
    description: 'Permanently deletes an event by ID',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventService.hardDelete(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
