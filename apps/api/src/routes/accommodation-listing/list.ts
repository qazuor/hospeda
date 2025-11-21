import { AccommodationListingListHttpQuerySchema, AccommodationListingSchema } from '@repo/schemas';
import { AccommodationListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const accommodationListingListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodation listings',
    description: 'Returns a paginated list of accommodation listings',
    tags: ['Accommodation Listings'],
    requestQuery: AccommodationListingListHttpQuerySchema.shape,
    responseSchema: AccommodationListingSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new AccommodationListingService({ logger: apiLogger });
        const result = await service.search(actor, { ...query, page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
