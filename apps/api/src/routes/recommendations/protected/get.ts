/**
 * GET /api/v1/protected/recommendations
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
