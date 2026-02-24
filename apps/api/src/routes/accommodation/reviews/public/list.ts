/**
 * Public accommodation reviews list endpoint
 * Returns paginated list of reviews for a specific accommodation
 */
import {
    AccommodationIdSchema,
    AccommodationReviewSchema,
    AccommodationReviewsByAccommodationHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createPublicListRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/public/accommodations/:accommodationId/reviews
 * List accommodation reviews - Public endpoint
 */
export const publicListAccommodationReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{accommodationId}/reviews',
    summary: 'List accommodation reviews',
    description: 'Returns a paginated list of reviews for a specific accommodation',
    tags: ['Accommodation Reviews'],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestQuery: AccommodationReviewsByAccommodationHttpSchema.shape,
    responseSchema: AccommodationReviewSchema,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.listByAccommodation(actor, {
            accommodationId: params.accommodationId as string,
            page,
            pageSize,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return {
            items: result.data.accommodationReviews || [],
            pagination: getPaginationResponse(result.data.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
