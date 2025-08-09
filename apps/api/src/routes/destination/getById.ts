import { DestinationDetailSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const destinationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get destination by ID',
    description: 'Retrieves a destination by its ID using the DestinationService',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
