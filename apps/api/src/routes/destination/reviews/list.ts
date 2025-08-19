import { z } from '@hono/zod-openapi';
import { DestinationIdSchema, DestinationReviewSchema } from '@repo/schemas';
import { DestinationReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createListRoute } from '../../../utils/route-factory';

// Instantiate inside handler to play well with test mocks

export const listDestinationReviewsRoute = createListRoute({
    method: 'get',
    path: '/{destinationId}/reviews',
    summary: 'List destination reviews',
    description: 'Returns a paginated list of reviews for a specific destination',
    tags: ['Destinations', 'Reviews'],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: z.object(DestinationReviewSchema.shape),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const validatedQuery = query as { page?: number; limit?: number };
        const page = validatedQuery.page ?? 1;
        const pageSize = validatedQuery.limit ?? 10;
        // Reuse generic list from BaseCrudService with a where filter if needed; for now, simple list
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data.items,
            pagination: {
                page,
                limit: pageSize,
                total: result.data.total,
                totalPages: Math.ceil(result.data.total / pageSize)
            }
        };
    }
});
