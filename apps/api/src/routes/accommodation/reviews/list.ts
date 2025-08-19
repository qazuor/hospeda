import { z } from '@hono/zod-openapi';
import { AccommodationIdSchema, AccommodationReviewSchema } from '@repo/schemas';
import { AccommodationReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createListRoute } from '../../../utils/route-factory';

// Lazy-instantiate service inside handler to ensure tests pick the mock

export const listAccommodationReviewsRoute = createListRoute({
    method: 'get',
    path: '/{accommodationId}/reviews',
    summary: 'List accommodation reviews',
    description: 'Returns a paginated list of reviews for a specific accommodation',
    tags: ['Accommodations', 'Reviews'],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: z.object(AccommodationReviewSchema.shape),
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        // query is validated and always defined in createListRoute; cast explicitly for types
        const validatedQuery = query as { page?: number; limit?: number };
        const page = validatedQuery.page ?? 1;
        const pageSize = validatedQuery.limit ?? 10;
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.listByAccommodation(actor, {
            accommodationId: params.accommodationId as z.infer<typeof AccommodationIdSchema>,
            page,
            pageSize
        });
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
