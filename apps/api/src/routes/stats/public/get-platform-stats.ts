/**
 * Public platform statistics endpoint
 * Returns aggregate counts for the main content types on the platform
 */
import {
    AccommodationReviewService,
    AccommodationService,
    DestinationReviewService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });
const destinationService = new DestinationService({ logger: apiLogger });
const eventService = new EventService({ logger: apiLogger });
const postService = new PostService({ logger: apiLogger });
const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * Response schema for platform-wide statistics
 */
const PlatformStatsSchema = z.object({
    accommodations: z.number().int().min(0),
    destinations: z.number().int().min(0),
    events: z.number().int().min(0),
    posts: z.number().int().min(0),
    reviews: z.number().int().min(0)
});

/**
 * GET /api/v1/public/stats
 * Returns counts of active accommodations, destinations, events, posts, and reviews.
 * Results are cached for 1 hour as this is aggregate data that changes slowly.
 */
export const publicGetPlatformStatsRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Get platform statistics',
    description:
        'Returns aggregate counts for accommodations, destinations, events, posts, and reviews',
    tags: ['Stats'],
    responseSchema: PlatformStatsSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const baseParams = { page: 1, pageSize: 1 } as const;

        const [
            accommodationResult,
            destinationResult,
            eventResult,
            postResult,
            accommodationReviewResult,
            destinationReviewResult
        ] = await Promise.all([
            accommodationService.count(actor, baseParams),
            destinationService.count(actor, baseParams),
            eventService.count(actor, baseParams),
            postService.count(actor, baseParams),
            accommodationReviewService.count(actor, baseParams),
            destinationReviewService.count(actor, baseParams)
        ]);

        const accommodations = accommodationResult.data?.count ?? 0;
        const destinations = destinationResult.data?.count ?? 0;
        const events = eventResult.data?.count ?? 0;
        const posts = postResult.data?.count ?? 0;
        const accommodationReviews = accommodationReviewResult.data?.count ?? 0;
        const destinationReviews = destinationReviewResult.data?.count ?? 0;

        return {
            accommodations,
            destinations,
            events,
            posts,
            reviews: accommodationReviews + destinationReviews
        };
    },
    options: {
        cacheTTL: 3600
    }
});
