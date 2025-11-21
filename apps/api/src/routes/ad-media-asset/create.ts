import { AdMediaAssetSchema, CreateAdMediaAssetSchema } from '@repo/schemas';
import { AdMediaAssetService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adMediaAssetCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create ad media asset',
    description: 'Creates a new ad media asset',
    tags: ['Ad Media Assets'],
    requestBody: CreateAdMediaAssetSchema,
    responseSchema: AdMediaAssetSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdMediaAssetService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateAdMediaAssetSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
