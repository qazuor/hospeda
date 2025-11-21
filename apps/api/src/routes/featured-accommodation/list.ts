import { FeaturedAccommodationSchema, FeaturedAccommodationSearchQuerySchema } from '@repo/schemas';
import { FeaturedAccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const featuredAccommodationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List featured accommodations',
    description: 'Returns a paginated list of featured accommodations',
    tags: ['Featured Accommodations'],
    requestQuery: FeaturedAccommodationSearchQuerySchema.shape,
    responseSchema: FeaturedAccommodationSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new FeaturedAccommodationService({ logger: apiLogger });
        const result = await service.search(actor, { ...query, page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
