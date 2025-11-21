import { SearchServiceOrdersSchema, ServiceOrderSchema } from '@repo/schemas';
import { ProfessionalServiceOrderService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const professionalServiceOrderListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List professional service orders',
    description: 'Returns a paginated list of professional service orders',
    tags: ['Professional Service Orders'],
    requestQuery: SearchServiceOrdersSchema.shape,
    responseSchema: ServiceOrderSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new ProfessionalServiceOrderService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
