/**
 * Public destination reviews list endpoint
 * Returns paginated list of reviews for a destination
 */
import {
    DestinationIdSchema,
    DestinationReviewSchema,
    DestinationReviewsByDestinationHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createPublicListRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/public/destinations/:destinationId/reviews
 * List destination reviews - Public endpoint
 */
export const publicListDestinationReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{destinationId}/reviews',
    summary: 'List destination reviews',
    description: 'Returns a paginated list of reviews for a specific destination',
    tags: ['Destinations', 'Reviews'],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestQuery: DestinationReviewsByDestinationHttpSchema.shape,
    responseSchema: DestinationReviewSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.list(actor, { page, pageSize });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return {
            items: result.data.items,
            pagination: getPaginationResponse(result.data.total, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
