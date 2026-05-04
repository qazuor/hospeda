/**
 * Public platform statistics endpoint
 * Returns aggregate counts for the main content types on the platform plus
 * the global accommodation rating average. Intended for marketing surfaces
 * (footer trust signals, landing hero stats).
 */
import { PublicPlatformStatsSchema } from '@repo/schemas';
import {
    AccommodationReviewService,
    AccommodationService,
    DestinationReviewService,
    DestinationService,
    EventService,
    PostService,
    StatsService
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * Number of recent reviewer avatars exposed by the public stats endpoint.
 * Sized to cover the hero "social proof" overlay (4 visible + buffer).
 */
const RECENT_REVIEWER_AVATARS_LIMIT = 6;

const accommodationService = new AccommodationService({ logger: apiLogger });
const destinationService = new DestinationService({ logger: apiLogger });
const eventService = new EventService({ logger: apiLogger });
const postService = new PostService({ logger: apiLogger });
const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });
const statsService = new StatsService({ logger: apiLogger });

/**
 * GET /api/v1/public/stats
 * Returns counts of active accommodations, destinations, events, posts, and
 * reviews, plus the global accommodation rating average. Cached for 1 hour
 * because this is aggregate data that changes slowly.
 */
export const publicGetPlatformStatsRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Get platform statistics',
    description:
        'Returns aggregate counts for accommodations, destinations, events, posts, reviews and the global accommodation rating average',
    tags: ['Stats'],
    responseSchema: PublicPlatformStatsSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const baseParams = { page: 1, pageSize: 1 } as const;

        const [
            accommodationResult,
            destinationResult,
            eventResult,
            postResult,
            accommodationReviewResult,
            destinationReviewResult,
            averageRating,
            recentReviewerAvatars
        ] = await Promise.all([
            accommodationService.count(actor, baseParams),
            destinationService.count(actor, baseParams),
            eventService.count(actor, baseParams),
            postService.count(actor, baseParams),
            accommodationReviewService.count(actor, baseParams),
            destinationReviewService.count(actor, baseParams),
            statsService.getGlobalAccommodationAverageRating(),
            statsService.getRecentReviewerAvatars({ limit: RECENT_REVIEWER_AVATARS_LIMIT })
        ]);

        const accommodations = accommodationResult.data?.count ?? 0;
        const destinations = destinationResult.data?.count ?? 0;
        const events = eventResult.data?.count ?? 0;
        const posts = postResult.data?.count ?? 0;
        const accommodationReviewsCount = accommodationReviewResult.data?.count ?? 0;
        const destinationReviewsCount = destinationReviewResult.data?.count ?? 0;

        return {
            accommodations,
            destinations,
            events,
            posts,
            reviews: accommodationReviewsCount + destinationReviewsCount,
            averageRating,
            recentReviewerAvatars: [...recentReviewerAvatars]
        };
    },
    options: {
        cacheTTL: 3600
    }
});
