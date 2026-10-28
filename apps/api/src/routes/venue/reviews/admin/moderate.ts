/**
 * Admin moderate venue review endpoint — T-046.
 *
 * Approves or rejects a single venue review. Delegates the state
 * transition to `VenueReviewService.moderateReview()`, which gates the
 * action on {@link PermissionEnum.VENUE_MODERATE_REVIEW}.
 *
 * @module routes/venue/reviews/admin/moderate
 * @see SPEC-239 T-046
 */
import { PermissionEnum, ReviewModerateInputSchema, VenueReviewSchema } from '@repo/schemas';
import { ServiceError, VenueReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const venueReviewService = new VenueReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/venues/reviews/:id/moderate
 *
 * Applies a moderation decision (`APPROVED` | `REJECTED`) to a single
 * venue review. Sets `moderationState`, `moderatedById`, `moderatedAt`,
 * and optionally `moderationReason` on the persisted row. Also triggers
 * rating recompute on the parent venue listing.
 *
 * Returns the updated review.
 *
 * @throws 400 if `decision` is not `APPROVED` or `REJECTED`.
 * @throws 403 if the actor lacks VENUE_MODERATE_REVIEW.
 * @throws 404 if the review does not exist.
 */
export const adminModerateVenueReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate a venue reviews (admin)',
    description:
        'Approves or rejects a venue reviews. Sets moderationState, moderatedById, ' +
        'moderatedAt, and optionally moderationReason. Triggers rating recompute on the listing. ' +
        'Requires VENUE_MODERATE_REVIEW.',
    tags: ['Gastronomy Reviews', 'Admin'],
    anyOfPermissions: [[PermissionEnum.VENUE_MODERATE_REVIEW]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ReviewModerateInputSchema,
    responseSchema: VenueReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, reason } = ReviewModerateInputSchema.parse(body);

        const result = await venueReviewService.moderateReview({ id, decision, reason }, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
