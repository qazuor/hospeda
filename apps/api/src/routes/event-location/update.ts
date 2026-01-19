import {
    EventLocationIdSchema,
    EventLocationSchema,
    EventLocationUpdateInputSchema
} from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

export const updateEventLocationRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event location',
    description: 'Updates an event location by ID',
    tags: ['Event Locations'],
    requestParams: { id: EventLocationIdSchema },
    requestBody: EventLocationUpdateInputSchema,
    responseSchema: EventLocationSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventLocationService.update(actor, id, body as never);
        if (result.error) throw result.error;
        return result.data;
    }
});
