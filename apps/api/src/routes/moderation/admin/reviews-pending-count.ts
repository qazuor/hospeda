/**
 * Admin reviews pending-count endpoint — SPEC-166 T-019.
 *
 * Returns a count of reviews in PENDING moderation state broken down by
 * review type (accommodation vs destination). Intended for the admin dashboard
 * moderation card (feature F).
 *
 * Permission: any actor that holds at least one of the two moderate permissions
 * (`ACCOMMODATION_REVIEW_MODERATE` or `DESTINATION_REVIEW_MODERATE`) is
 * expected by the spec to be able to see the pending-count card.
 *
 * Implementation note: both services gate their own `getPendingCount()` method
 * internally, so we call both and surface partial results if one is forbidden
 * (the route-level factory uses `ACCOMMODATION_REVIEW_MODERATE` as the gate
 * because that is the "any moderator can read this" convention established by
 * the SPEC-155 T-010 dashboard endpoint). Services that gate on a different
 * permission will return `{ error }`, which we treat as zero rather than
 * propagating, so a destination-only moderator still sees a useful number.
 *
 * @module routes/moderation/admin/reviews-pending-count
 * @see SPEC-166 T-019
 */
import { PermissionEnum, ReviewPendingCountSchema } from '@repo/schemas';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError
} from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/reviews/pending-count
 *
 * Returns `{ count, byType: { accommodationReviews, destinationReviews } }`.
 *
 * Both service calls run in parallel. The route is gated on
 * `ACCOMMODATION_REVIEW_MODERATE` (matches the "any review moderator" intent).
 * If a service's own internal permission check fails (e.g. the actor holds only
 * the destination moderate permission), its count falls back to 0 so the
 * response is still useful.
 *
 * Cached for 60 seconds to reduce DB load on repeated dashboard loads.
 */
export const adminReviewsPendingCountRoute = createAdminRoute({
    method: 'get',
    path: '/reviews/pending-count',
    summary: 'Get review moderation pending count (admin)',
    description:
        'Returns the count of PENDING-moderation reviews broken down by review type ' +
        '(accommodation vs destination). Intended for the admin dashboard moderation card. ' +
        'Requires ACCOMMODATION_REVIEW_MODERATE permission.',
    tags: ['Reviews', 'Moderation'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE],
    responseSchema: ReviewPendingCountSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const [accResult, destResult] = await Promise.all([
            accommodationReviewService.getPendingCount({ actor }),
            destinationReviewService.getPendingCount({ actor })
        ]);

        const accommodationReviews = accResult.data?.count ?? 0;
        const destinationReviews = destResult.data?.count ?? 0;
        const count = accommodationReviews + destinationReviews;

        apiLogger.debug(
            { count, accommodationReviews, destinationReviews },
            'adminReviewsPendingCountRoute: result'
        );

        // If BOTH services failed (e.g. actor lacks all review moderate permissions),
        // surface the primary error so the route factory can respond with 403.
        if (accResult.error && destResult.error) {
            throw new ServiceError(accResult.error.code, accResult.error.message);
        }

        return { count, byType: { accommodationReviews, destinationReviews } };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
