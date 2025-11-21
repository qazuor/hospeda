import { z } from '@hono/zod-openapi';
import { AdMediaAssetSchema } from '@repo/schemas';
import { AdMediaAssetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adMediaAssetGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get ad media asset by ID',
    description: 'Returns a single ad media asset by ID',
    tags: ['Ad Media Assets'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AdMediaAssetSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AdMediaAssetService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
