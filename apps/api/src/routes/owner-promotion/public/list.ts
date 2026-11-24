/**
 * Public owner promotion list endpoint
 * Returns paginated list of public owner promotions
 */
import {
    OwnerPromotionPublicSchema,
    type OwnerPromotionSearchInput,
    OwnerPromotionSearchSchema
} from '@repo/schemas';
import {
    buildOwnerPromotionAudienceContext,
    OwnerPromotionService,
    ServiceError
} from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';
import { resolveTouristAudienceScope } from '../audience-scope';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/public/owner-promotions
 * List owner promotions - Public endpoint
 *
 * HOS-2590: VIP-only promotions (`touristAudience = vip`) reach only a reader
 * whose TOURIST effective set grants `vip_promotions_access`. The answer varies
 * per actor, so this path must never join `PUBLIC_CACHE_ENDPOINTS` nor carry a
 * public `Cache-Control`.
 */
export const publicListOwnerPromotionsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List owner promotions',
    description: 'Returns a paginated list of owner promotions',
    tags: ['Owner Promotions'],
    requestQuery: OwnerPromotionSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: OwnerPromotionPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const audienceScope = await resolveTouristAudienceScope({ actor });

        const result = await ownerPromotionService.search(
            actor,
            { ...(query as OwnerPromotionSearchInput), page, pageSize },
            buildOwnerPromotionAudienceContext({ audienceScope })
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
