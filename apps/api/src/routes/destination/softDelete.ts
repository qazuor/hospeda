import { DestinationIdSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const softDeleteDestinationRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete destination',
    description: 'Soft deletes a destination by ID',
    tags: ['Destinations'],
    requestParams: { id: DestinationIdSchema },
    responseSchema: DestinationIdSchema, // simple echo schema
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.softDelete(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
