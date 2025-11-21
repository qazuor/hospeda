import { AdPricingCatalogSchema, CreateAdPricingCatalogSchema } from '@repo/schemas';
import { AdPricingCatalogService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adPricingCatalogCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create ad pricing catalog',
    description: 'Creates a new ad pricing catalog entry',
    tags: ['Ad Pricing Catalog'],
    requestBody: CreateAdPricingCatalogSchema,
    responseSchema: AdPricingCatalogSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdPricingCatalogService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateAdPricingCatalogSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
