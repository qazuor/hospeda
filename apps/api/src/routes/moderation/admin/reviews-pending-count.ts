/**
 * Admin reviews pending-count endpoint — SPEC-166 T-019.
 *
 * Returns a count of reviews in PENDING moderation state broken down by
 * review type (accommodation vs destination). Intended for the admin dashboard
 * moderation card (feature F).
 *
 * Permission model (spec §7 — OR semantics):
 *   Any actor with ACCOMMODATION_REVIEW_MODERATE **or** DESTINATION_REVIEW_MODERATE
 *   may call this endpoint. A route-level `requiredPermissions` with AND semantics
 *   would block destination-only moderators, so no `requiredPermissions` is set here —
 *   the base admin-access check (ADMIN / SUPER_ADMIN role) runs as the gate.
 *   Per-type permission enforcement is delegated to each service's own
 *   `getPendingCount()` method: if an actor lacks the relevant permission, that
 *   service returns `{ error }` which is treated as zero (partial response).
 *   Only when BOTH services deny does the handler re-throw, producing a 403.
 *
 * @module routes/moderation/admin/reviews-pending-count
 * @see SPEC-166 T-019
 */
import { ReviewPendingCountSchema } from '@repo/schemas';
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
 * Both service calls run in parallel. Gate: base admin access (ADMIN / SUPER_ADMIN)
 * checked by the factory middleware — no additional `requiredPermissions` so that
 * destination-only moderators are not blocked at the route level (spec §7 OR gate).
 * Each service enforces its own per-type permission; a denied service contributes 0.
 * Only when BOTH services deny does the handler throw, producing a 403.
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
        'Gate: base admin access; per-type counts gated by each service (OR semantics per spec §7).',
    tags: ['Reviews', 'Moderation'],
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
