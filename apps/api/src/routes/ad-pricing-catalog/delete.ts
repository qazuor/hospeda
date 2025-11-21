import { z } from '@hono/zod-openapi';
import { AdPricingCatalogSchema } from '@repo/schemas';
import { AdPricingCatalogService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adPricingCatalogDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete ad pricing catalog',
    description: 'Soft deletes an ad pricing catalog',
    tags: ['Ad Pricing Catalog'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AdPricingCatalogSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AdPricingCatalogService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
