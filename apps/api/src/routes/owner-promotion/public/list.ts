/**
 * Public owner promotion list endpoint
 * Returns paginated list of public owner promotions
 */
import {
    OwnerPromotionPublicSchema,
    type OwnerPromotionSearchInput,
    OwnerPromotionSearchSchema
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/public/owner-promotions
 * List owner promotions - Public endpoint
 */
export const publicListOwnerPromotionsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List owner promotions',
    description: 'Returns a paginated list of owner promotions',
    tags: ['Owner Promotions'],
    requestQuery: OwnerPromotionSearchSchema.omit({ page: true, limit: true }).shape,
    responseSchema: OwnerPromotionPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await ownerPromotionService.search(actor, {
            ...(query as OwnerPromotionSearchInput),
            page,
            limit: pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // AC-005-01: strip admin-only fields (lifecycleState, ownerId,
        // currentRedemptions, audit fields) via OwnerPromotionPublicSchema
        // before the response leaves the public tier. The route factory only
        // uses responseSchema for OpenAPI docs, not runtime validation, so
        // the strip must happen here. Tracked systemically in SPEC-087.
        const rawItems = result.data?.items ?? [];
        const items = rawItems.map((item) => OwnerPromotionPublicSchema.parse(item));

        return {
            items,
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
