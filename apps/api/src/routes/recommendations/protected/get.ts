/**
 * GET /api/v1/protected/recommendations
 *
 * Returns the authenticated user's personalized recommendations feed —
 * a ranked list of accommodations scored against the user's behavioral
 * preference profile (favorites, recently-viewed, search history), or the
 * popular/featured cold-start fallback when that profile has no signal yet
 * (`isColdStart: true`).
 *
 * The service still enforces `PermissionEnum.RECOMMENDATION_VIEW` (role axis) —
 * see `RecommendationService.getFeed` for the authorization breakdown.
 *
 * No query params: the feed is always scoped to the actor's own id and the
 * feed has no pagination.
 *
 * @route GET /api/v1/protected/recommendations
 * @module routes/recommendations/protected/get
 */
import { RecommendationFeedResponseSchema, VerticalEnum } from '@repo/schemas';
import { RecommendationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
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
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['can_view_recommendations']
        });

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
