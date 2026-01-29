/**
 * Public owner promotion list endpoint
 * Returns paginated list of public owner promotions
 */
import {
    OwnerPromotionSchema,
    OwnerPromotionSearchSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createPublicListRoute } from '../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/public/owner-promotions
 * List owner promotions - Public endpoint
 */
export const ownerPromotionListRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List owner promotions',
    description: 'Returns a paginated list of owner promotions',
    tags: ['Owner Promotions'],
    requestQuery: OwnerPromotionSearchSchema.omit({ page: true, limit: true }).shape,
    responseSchema: OwnerPromotionSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await ownerPromotionService.list(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
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
