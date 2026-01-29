/**
 * Public endpoint to get accommodations by feature
 * Returns paginated list of accommodations that have a specific feature
 */
import {
    AccommodationListItemSchema,
    BaseHttpSearchSchema,
    FeatureIdSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features/:id/accommodations
 * Get accommodations by feature - Public endpoint
 */
export const publicGetAccommodationsByFeatureRoute = createPublicListRoute({
    method: 'get',
    path: '/{featureId}/accommodations',
    summary: 'Get accommodations by feature',
    description: 'Returns a list of accommodations that include a specific feature',
    tags: ['Features', 'Accommodations'],
    requestParams: { featureId: FeatureIdSchema },
    responseSchema: AccommodationListItemSchema,
    requestQuery: BaseHttpSearchSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.getAccommodationsByFeature(actor, {
            featureId: params.featureId as string
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        const { page, pageSize } = extractPaginationParams(query || {});
        return {
            items: result.data.accommodations,
            pagination: getPaginationResponse(result.data.accommodations.length, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
