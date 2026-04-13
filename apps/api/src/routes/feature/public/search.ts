/**
 * Public feature search endpoint
 * Returns paginated list of features based on search criteria
 */
import {
    FeatureListItemSchema,
    type HttpFeatureSearch,
    HttpFeatureSearchSchema
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features/search
 * Search features with advanced filtering - Public endpoint
 */
export const publicSearchFeaturesRoute = createPublicListRoute({
    method: 'get',
    path: '/search',
    summary: 'Search features with advanced filtering',
    description: 'Search and filter features by name, category, availability, and other criteria',
    tags: ['Features'],
    requestQuery: HttpFeatureSearchSchema.shape,
    responseSchema: FeatureListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await featureService.search(actor, {
            ...(query as HttpFeatureSearch),
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
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
