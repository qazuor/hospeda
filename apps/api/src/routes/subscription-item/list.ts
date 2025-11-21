import { SubscriptionItemQueryHttpSchema, SubscriptionItemSchema } from '@repo/schemas';
import { SubscriptionItemService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const subscriptionItemListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List subscription items',
    description: 'Returns a paginated list of subscription items with optional filtering',
    tags: ['Subscription Items'],
    requestQuery: SubscriptionItemQueryHttpSchema.shape,
    responseSchema: SubscriptionItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        const service = new SubscriptionItemService({ logger: apiLogger });
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
