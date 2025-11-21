import { PurchaseQueryHttpSchema, PurchaseSchema } from '@repo/schemas';
import { PurchaseService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const purchaseListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List purchases',
    description: 'Returns a paginated list of purchases with optional filtering',
    tags: ['Purchases'],
    requestQuery: PurchaseQueryHttpSchema.shape,
    responseSchema: PurchaseSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        const service = new PurchaseService({ logger: apiLogger });
        const result = await service.list(actor, {
            ...(query as Record<string, unknown>),
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
