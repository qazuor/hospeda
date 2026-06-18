/**
 * Admin moderate experience review endpoint — T-021.
 *
 * Approves or rejects a single experience review. Delegates the state
 * transition to `ExperienceReviewService.moderateReview()`, which gates the
 * action on {@link PermissionEnum.COMMERCE_MODERATE_REVIEW}.
 *
 * @module routes/experience/reviews/admin/moderate
 * @see SPEC-240 T-021
 */
import { ExperienceReviewSchema, PermissionEnum, ReviewModerateInputSchema } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const experienceReviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/reviews/:id/moderate
 *
 * Applies a moderation decision (`APPROVED` | `REJECTED`) to a single
 * experience review. Sets `moderationState`, `moderatedById`, `moderatedAt`,
 * and optionally `moderationReason` on the persisted row. Also triggers
 * rating recompute on the parent experience listing.
 *
 * Returns the updated review.
 *
 * @throws 400 if `decision` is not `APPROVED` or `REJECTED`.
 * @throws 403 if the actor lacks `COMMERCE_MODERATE_REVIEW`.
 * @throws 404 if the review does not exist.
 */
export const adminModerateExperienceReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate an experience review (admin)',
    description:
        'Approves or rejects an experience review. Sets moderationState, moderatedById, ' +
        'moderatedAt, and optionally moderationReason. Triggers rating recompute on the listing. ' +
        'Requires COMMERCE_MODERATE_REVIEW.',
    tags: ['Experience Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ReviewModerateInputSchema,
    responseSchema: ExperienceReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, reason } = ReviewModerateInputSchema.parse(body);

        const result = await experienceReviewService.moderateReview(
            { id, decision, reason },
            actor
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
