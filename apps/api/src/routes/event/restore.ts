import { EventIdSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Protected route: Restore event
 *
 * Restores a previously soft-deleted event using `EventService.restore`.
 * Returns an echo object with the `id` on success.
 *
 * - Method: POST
 * - Path: `/{id}/restore`
 * - Params: `id` (EventId)
 * - Response: `{ id: EventId }`
 */
export const restoreEventRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore event',
    description: 'Restores a soft-deleted event',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventService.restore(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
