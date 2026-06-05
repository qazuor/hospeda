/**
 * Admin moderate accommodation review endpoint — SPEC-166 T-020.
 *
 * Approves or rejects a single accommodation review. Delegates the state
 * transition to `AccommodationReviewService.moderateReview()`, which gates the
 * action on {@link PermissionEnum.ACCOMMODATION_REVIEW_MODERATE}.
 *
 * @module routes/accommodation/reviews/admin/moderate
 * @see SPEC-166 T-020
 */
import {
    AccommodationReviewAdminSchema,
    AccommodationReviewIdSchema,
    PermissionEnum,
    ReviewModerateInputSchema
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodation-reviews/:id/moderate
 *
 * Applies the moderation decision (`APPROVED` | `REJECTED`) to a single
 * accommodation review. Sets `moderationState`, `moderatedById`,
 * `moderatedAt`, and optionally `moderationReason` on the persisted row.
 *
 * Returns the updated review in its full admin representation.
 *
 * @throws 400 if `decision` is not `APPROVED` or `REJECTED`.
 * @throws 403 if the actor lacks `ACCOMMODATION_REVIEW_MODERATE`.
 * @throws 404 if the review does not exist.
 */
export const adminModerateAccommodationReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate an accommodation review (admin)',
    description:
        'Approves or rejects an accommodation review. Sets moderationState, moderatedById, ' +
        'moderatedAt, and optionally moderationReason. Requires ACCOMMODATION_REVIEW_MODERATE.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    requestBody: ReviewModerateInputSchema,
    responseSchema: AccommodationReviewAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, reason } = ReviewModerateInputSchema.parse(body);

        const result = await accommodationReviewService.moderateReview({
            id,
            decision,
            reason,
            actor
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
