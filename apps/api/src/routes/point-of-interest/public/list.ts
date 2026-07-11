/**
 * Public point-of-interest list endpoint
 * Returns paginated list of public points of interest
 */
import {
    PointOfInterestPublicSchema,
    type PointOfInterestSearchHttp,
    PointOfInterestSearchHttpSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/public/points-of-interest
 * List points of interest - Public endpoint
 */
export const publicListPointsOfInterestRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List points of interest',
    description: 'Returns a paginated list of public points of interest',
    tags: ['PointsOfInterest'],
    requestQuery: PointOfInterestSearchHttpSchema.shape,
    responseSchema: PointOfInterestPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await pointOfInterestService.search(actor, {
            ...(query as PointOfInterestSearchHttp),
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
