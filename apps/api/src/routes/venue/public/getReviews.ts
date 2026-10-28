/**
 * Public venue reviews list endpoint (T-042)
 * Returns a paginated list of APPROVED reviews for a specific venue listing.
 *
 * VenueReviewService.listByVenue() force-filters lifecycleState=ACTIVE AND
 * moderationState=APPROVED so that PENDING / REJECTED reviews never surface here
 * (mirrors the SPEC-166 accommodation review pattern).
 */
import { VenueReviewSchema } from '@repo/schemas';
import { ServiceError, VenueReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const reviewService = new VenueReviewService({ logger: apiLogger });

/**
 * Safe public review projection — strips admin-only and moderation fields
 * before the response leaves the public tier.
 *
 * The `user` extension (Bug B7b fix) exposes only safe public fields from the
 * eagerly-loaded user relation: no email, no role, no sensitive audit fields.
 */
const VenueReviewPublicSchema = VenueReviewSchema.pick({
    id: true,
    venueId: true,
    userId: true,
    title: true,
    content: true,
    rating: true,
    averageRating: true,
    overallRating: true,
    reviewerName: true,
    createdAt: true,
    updatedAt: true
}).extend({
    /** Reviewer's public profile from the users JOIN (no email/role/sensitive fields). */
    user: z
        .object({
            id: z.string().uuid(),
            name: z.string().nullish(),
            displayName: z.string().nullish(),
            firstName: z.string().nullish(),
            image: z.string().nullish()
        })
        .nullish()
});

/**
 * GET /api/v1/public/venues/:venueId/reviews
 * List APPROVED venue reviews — Public endpoint.
 *
 * Uses VenueReviewService.listByVenue() which force-filters to
 * ACTIVE + APPROVED reviews only. At most 100 reviews per call (service cap).
 */
export const publicListVenueReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{venueId}/reviews',
    summary: 'List venue reviews',
    description: 'Returns a paginated list of approved reviews for a specific venue listing',
    tags: ['Venue', 'venue reviews'],
    requestParams: {
        venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueReviewPublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await reviewService.listByVenue(params.venueId as string, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const reviews = result.data?.reviews || [];
        const total = result.data?.total || 0;

        // Parse page/pageSize from query for pagination metadata only.
        // listByVenue() uses a fixed cap of 100; no server-side pagination.
        const page = Number((query as Record<string, unknown>)?.page ?? 1);
        const pageSize = Math.min(Number((query as Record<string, unknown>)?.pageSize ?? 20), 100);

        return {
            items: reviews,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
