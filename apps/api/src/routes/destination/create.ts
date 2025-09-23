import { DestinationCreateInputSchema, DestinationSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const createDestinationRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create destination',
    description: 'Creates a new destination',
    tags: ['Destinations'],
    requestBody: DestinationCreateInputSchema,
    responseSchema: DestinationSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.create(actor, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
