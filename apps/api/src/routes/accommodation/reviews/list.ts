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
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        q: z.string().optional()
    },
    responseSchema: z.object(AccommodationReviewSchema.shape),
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        // query is validated and always defined in createListRoute; cast explicitly for types
        const validatedQuery = query as { page?: number; pageSize?: number };
        const page = validatedQuery.page ?? 1;
        const pageSize = validatedQuery.pageSize ?? 20;
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.listByAccommodation(actor, {
            accommodationId: params.accommodationId as z.infer<typeof AccommodationIdSchema>,
            page,
            pageSize,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data.accommodationReviews || [],
            pagination: {
                page,
                pageSize,
                total: result.data.accommodationReviews?.length || 0,
                totalPages: 1
            }
        };
    }
});
