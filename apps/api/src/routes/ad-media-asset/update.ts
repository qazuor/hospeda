import { z } from '@hono/zod-openapi';
import { AdMediaAssetSchema, UpdateAdMediaAssetSchema } from '@repo/schemas';
import { AdMediaAssetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adMediaAssetUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update ad media asset',
    description: 'Updates an existing ad media asset',
    tags: ['Ad Media Assets'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateAdMediaAssetSchema,
    responseSchema: AdMediaAssetSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdMediaAssetService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateAdMediaAssetSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
