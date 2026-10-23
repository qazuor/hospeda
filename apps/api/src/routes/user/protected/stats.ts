/**
 * User stats endpoint.
 * Returns aggregated statistics for the authenticated user.
 * @route GET /api/v1/protected/users/me/stats
 */

import { UserStatsResponseSchema } from '@repo/schemas';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError,
    UserBookmarkService
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { readAccountPlanSummary } from './stats-plan-summary';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });
const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

export const userStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/me/stats',
    summary: 'Get user statistics',
    description:
        'Returns aggregated statistics for the authenticated user including bookmark count, review count and plan info.',
    tags: ['Users'],
    responseSchema: UserStatsResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const bookmarkCountResult = await bookmarkService.countBookmarksForUser(actor, {
            userId: actor.id
        });

        if (bookmarkCountResult.error) {
            throw new ServiceError(
                bookmarkCountResult.error.code,
                bookmarkCountResult.error.message
            );
        }

        const bookmarkCount = bookmarkCountResult.data?.count ?? 0;

        /** Fetch review counts from both review services */
        const [accReviewResult, destReviewResult] = await Promise.all([
            accommodationReviewService.listByUser(actor, {
                userId: actor.id,
                page: 1,
                pageSize: 1,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            }),
            destinationReviewService.listByUser(actor, {
                userId: actor.id,
                page: 1,
                pageSize: 1,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            })
        ]);

        const accReviewTotal = accReviewResult.data?.total ?? 0;
        const destReviewTotal = destReviewResult.data?.pagination?.total ?? 0;
        const reviewCount = accReviewTotal + destReviewTotal;

        const summary = await readAccountPlanSummary({ userId: actor.id });
        return {
            bookmarkCount,
            reviewCount,
            ...summary
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
