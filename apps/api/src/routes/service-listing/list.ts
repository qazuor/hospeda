import { ServiceListingListHttpQuerySchema, ServiceListingSchema } from '@repo/schemas';
import { ServiceListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const serviceListingListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List service listings',
    description: 'Returns a paginated list of service listings',
    tags: ['Service Listings'],
    requestQuery: ServiceListingListHttpQuerySchema.shape,
    responseSchema: ServiceListingSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new ServiceListingService({ logger: apiLogger });
        const result = await service.search(actor, { ...query, page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
