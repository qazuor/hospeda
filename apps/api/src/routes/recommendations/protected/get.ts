/**
 * GET /api/v1/protected/recommendations
 *
 * Returns the authenticated user's personalized recommendations feed —
 * a ranked list of accommodations scored against the user's behavioral
 * preference profile (favorites, recently-viewed, search history), or the
 * popular/featured cold-start fallback when that profile has no signal yet
 * (`isColdStart: true`).
 *
 * Recommendations run without the former plan entitlement during the billing transition.
 * The service still enforces `PermissionEnum.RECOMMENDATION_VIEW` (role axis) —
 * see `RecommendationService.getFeed` for the authorization breakdown.
 *
 * No query params: the feed is always scoped to the actor's own id and the
 * feed has no pagination.
 *
 * @route GET /api/v1/protected/recommendations
 * @module routes/recommendations/protected/get
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */
import { RecommendationFeedResponseSchema } from '@repo/schemas';
import { RecommendationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const recommendationService = new RecommendationService({ logger: apiLogger });

/**
 * GET /api/v1/protected/recommendations
 * Returns the actor's personalized recommendations feed (or the cold-start
 * popular/featured fallback when the actor has no behavioral signal yet).
 */
export const getRecommendationsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'Get personalized recommendations feed',
    description:
        "Returns the authenticated user's personalized recommendations feed, ranked by preference-profile score (favorites, recently-viewed, search history). Falls back to a popular/featured feed (`isColdStart: true`) when the user has no behavioral signal yet.",
    tags: ['Recommendations'],
    responseSchema: RecommendationFeedResponseSchema,
    options: {
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed recommendations gate.
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const result = await recommendationService.getFeed(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            isColdStart: result.data?.isColdStart ?? true,
            generatedAt: result.data?.generatedAt ?? new Date()
        };
    }
});
