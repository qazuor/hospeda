import { TouristServiceSchema, TouristServiceSearchSchema } from '@repo/schemas';
import { TouristServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const touristServiceListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List tourist services',
    description: 'Returns a paginated list of tourist services',
    tags: ['Tourist Services'],
    requestQuery: TouristServiceSearchSchema.shape,
    responseSchema: TouristServiceSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new TouristServiceService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
