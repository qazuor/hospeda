import { AttractionListItemSchema, AttractionSearchHttpSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const attractionListRoute = createListRoute({
    method: 'get',
    path: '/attractions',
    summary: 'List attractions',
    description: 'Returns a paginated list of attractions using standardized HTTP schemas',
    tags: ['Attractions'],
    requestQuery: AttractionSearchHttpSchema.shape,
    responseSchema: AttractionListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const service = new AttractionService({ logger: apiLogger });
        const result = await service.list(actor, {
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
