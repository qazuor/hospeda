import {
    DestinationDetailSchema,
    DestinationIdSchema,
    DestinationUpdateSchema
} from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const updateDestinationRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update destination',
    description: 'Updates a destination by ID',
    tags: ['Destinations'],
    requestParams: { id: DestinationIdSchema },
    requestBody: DestinationUpdateSchema,
    responseSchema: DestinationDetailSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.update(actor, id, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
