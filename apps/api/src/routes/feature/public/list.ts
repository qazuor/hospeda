/**
 * Public feature list endpoint
 * Returns paginated list of public features
 */
import { FeatureListItemSchema, FeatureSearchHttpSchema } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features
 * List features - Public endpoint
 */
export const publicListFeaturesRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List features',
    description: 'Returns a paginated list of public features',
    tags: ['Features'],
    requestQuery: FeatureSearchHttpSchema.shape,
    responseSchema: FeatureListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await featureService.list(actor, {
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
