import {
    type HttpProductSearch,
    HttpProductSearchSchema,
    ProductSchema,
    httpToDomainProductSearch
} from '@repo/schemas';
import { ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const productListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List products',
    description: 'Returns a paginated list of products with filtering options',
    tags: ['Products'],
    requestQuery: HttpProductSearchSchema.shape,
    responseSchema: ProductSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        // Convert HTTP query params to domain search input
        const searchInput = httpToDomainProductSearch({
            ...(query as HttpProductSearch),
            page,
            pageSize
        });

        const service = new ProductService({ logger: apiLogger });
        const result = await service.list(actor, searchInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
