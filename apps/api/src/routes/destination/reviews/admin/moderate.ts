/**
 * Admin moderate destination review endpoint — SPEC-166 T-020.
 *
 * Approves or rejects a single destination review. Delegates the state
 * transition to `DestinationReviewService.moderateReview()`, which gates the
 * action on {@link PermissionEnum.DESTINATION_REVIEW_MODERATE}.
 *
 * @module routes/destination/reviews/admin/moderate
 * @see SPEC-166 T-020
 */
import {
    DestinationReviewAdminSchema,
    DestinationReviewIdSchema,
    PermissionEnum,
    ReviewModerateInputSchema
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/destination-reviews/:id/moderate
 *
 * Applies the moderation decision (`APPROVED` | `REJECTED`) to a single
 * destination review. Sets `moderationState`, `moderatedById`,
 * `moderatedAt`, and optionally `moderationReason` on the persisted row.
 *
 * Returns the updated review in its full admin representation.
 *
 * @throws 400 if `decision` is not `APPROVED` or `REJECTED`.
 * @throws 403 if the actor lacks `DESTINATION_REVIEW_MODERATE`.
 * @throws 404 if the review does not exist.
 */
export const adminModerateDestinationReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate a destination review (admin)',
    description:
        'Approves or rejects a destination review. Sets moderationState, moderatedById, ' +
        'moderatedAt, and optionally moderationReason. Requires DESTINATION_REVIEW_MODERATE.',
    tags: ['Destination Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE],
    requestParams: {
        id: DestinationReviewIdSchema
    },
    requestBody: ReviewModerateInputSchema,
    responseSchema: DestinationReviewAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, reason } = ReviewModerateInputSchema.parse(body);

        const result = await destinationReviewService.moderateReview({
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
