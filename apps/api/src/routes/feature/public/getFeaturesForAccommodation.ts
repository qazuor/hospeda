/**
 * Public endpoint to get features for an accommodation
 * Returns paginated list of features associated with an accommodation
 */
import { AccommodationIdSchema, BaseHttpSearchSchema, FeatureListItemSchema } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features/accommodation/:accommodationId
 * Get features for an accommodation - Public endpoint
 */
export const publicGetFeaturesForAccommodationRoute = createPublicListRoute({
    method: 'get',
    path: '/accommodation/{accommodationId}',
    summary: 'Get features for an accommodation',
    description: 'Returns a list of features associated to a given accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: AccommodationIdSchema },
    responseSchema: FeatureListItemSchema,
    requestQuery: BaseHttpSearchSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await featureService.getFeaturesForAccommodation(actor, {
            accommodationId: params.accommodationId as string
        });

        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        return {
            items: result.data.features,
            pagination: getPaginationResponse(result.data.features.length, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
