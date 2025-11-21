import { z } from '@hono/zod-openapi';
import { AdPricingCatalogSchema, UpdateAdPricingCatalogSchema } from '@repo/schemas';
import { AdPricingCatalogService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adPricingCatalogUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update ad pricing catalog',
    description: 'Updates an existing ad pricing catalog',
    tags: ['Ad Pricing Catalog'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateAdPricingCatalogSchema,
    responseSchema: AdPricingCatalogSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdPricingCatalogService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateAdPricingCatalogSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
