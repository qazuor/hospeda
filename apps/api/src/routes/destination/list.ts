import { z } from '@hono/zod-openapi';
import { DestinationListItemSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const destinationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List destinations',
    description: 'Returns a paginated list of destinations using the DestinationService',
    tags: ['Destinations'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        search: z.string().optional(),
        sortOrder: z.enum(['ASC', 'DESC']).optional()
    },
    responseSchema: DestinationListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const queryData = query as { page?: number; limit?: number; search?: string };
        const page = queryData.page ?? 1;
        const pageSize = queryData.limit ?? 10;
        const search = queryData.search;

        const result = await destinationService.searchForList(actor, {
            pagination: { page, pageSize },
            ...(search && { filters: { q: search } })
        });

        return {
            items: result.items,
            pagination: {
                page,
                limit: pageSize,
                total: result.total,
                totalPages: Math.ceil(result.total / pageSize)
            }
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
