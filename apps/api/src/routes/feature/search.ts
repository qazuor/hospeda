import {
    FeatureListItemSchema,
    type HttpFeatureSearch,
    HttpFeatureSearchSchema
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const searchFeaturesRoute = createListRoute({
    method: 'get',
    path: '/features/search',
    summary: 'Search features with advanced filtering',
    description: 'Search and filter features by name, category, availability, and other criteria',
    tags: ['Features'],
    requestQuery: HttpFeatureSearchSchema.shape,
    responseSchema: FeatureListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as HttpFeatureSearch;
        const { page, pageSize } = extractPaginationParams(searchParams);

        const service = new FeatureService({ logger: apiLogger });
        const result = await service.search(actor, searchParams);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
