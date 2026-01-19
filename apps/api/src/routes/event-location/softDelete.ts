import { EventLocationIdSchema } from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

export const softDeleteEventLocationRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event location',
    description: 'Soft deletes an event location by ID',
    tags: ['Event Locations'],
    requestParams: { id: EventLocationIdSchema },
    responseSchema: EventLocationIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventLocationService.softDelete(actor, id);
        if (result.error) throw result.error;
        return { id };
    }
});
