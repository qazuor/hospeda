import { AttractionIdSchema, AttractionSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

export const attractionGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get attraction by ID',
    description: 'Retrieves an attraction by its ID',
    tags: ['Attractions'],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: AttractionSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.getById(actor, params.id as string);
        if (result.error) throw result.error;
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
