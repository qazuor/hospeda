import { DiscountCodeUsageSchema, ListDiscountCodeUsagesSchema } from '@repo/schemas';
import { DiscountCodeUsageService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const discountCodeUsageListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List discount code usages',
    description: 'Returns a paginated list of discount code usages',
    tags: ['Discount Code Usage'],
    requestQuery: ListDiscountCodeUsagesSchema.shape,
    responseSchema: DiscountCodeUsageSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new DiscountCodeUsageService({ logger: apiLogger });
        const result = await service.search(actor, { ...query, page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
