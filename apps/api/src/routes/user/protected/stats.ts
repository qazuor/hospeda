/**
 * User stats endpoint.
 * Returns aggregated statistics for the authenticated user.
 * @route GET /api/v1/protected/users/me/stats
 */

import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError,
    UserBookmarkService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });
const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/** Response schema for user stats */
const UserStatsResponseSchema = z.object({
    bookmarkCount: z.number(),
    reviewCount: z.number(),
    /**
     * Plan info, populated only when exactly one product domain (HOS-1066)
     * has a live entitlement-granting subscription. `null` with
     * `activeSubscriptionsCount > 1` means the account has several active
     * subscriptions across domains — the UI renders a count summary instead
     * of a single plan and links to the (domain-scoped) subscription page.
     */
    plan: z
        .object({
            name: z.string(),
            status: z.string()
        })
        .nullable()
        .optional(),
    /**
     * Number of distinct product domains carrying a live entitlement-granting
     * subscription (HOS-1066). `0` means no active subscription (free tier),
     * `1` means `plan` above describes it, `2+` means the UI must show a
     * summary rather than a single plan.
     */
    activeSubscriptionsCount: z.number().optional()
});

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

        // The plan/subscription summary was removed with the legacy billing
        // system (HOS-1416); the response keeps its bookmark + review counts.
        return {
            bookmarkCount,
            reviewCount
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
