import { AdPricingCatalogSchema, AdPricingCatalogSearchSchema } from '@repo/schemas';
import { AdPricingCatalogService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const adPricingCatalogListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List ad pricing catalogs',
    description: 'Returns a paginated list of ad pricing catalogs',
    tags: ['Ad Pricing Catalog'],
    requestQuery: AdPricingCatalogSearchSchema.shape,
    responseSchema: AdPricingCatalogSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new AdPricingCatalogService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
