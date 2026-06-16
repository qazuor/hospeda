/**
 * Admin moderate gastronomy review endpoint — T-046.
 *
 * Approves or rejects a single gastronomy review. Delegates the state
 * transition to `GastronomyReviewService.moderateReview()`, which gates the
 * action on {@link PermissionEnum.COMMERCE_MODERATE_REVIEW}.
 *
 * @module routes/gastronomy/reviews/admin/moderate
 * @see SPEC-239 T-046
 */
import { GastronomyReviewSchema, PermissionEnum, ReviewModerateInputSchema } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const gastronomyReviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/reviews/:id/moderate
 *
 * Applies a moderation decision (`APPROVED` | `REJECTED`) to a single
 * gastronomy review. Sets `moderationState`, `moderatedById`, `moderatedAt`,
 * and optionally `moderationReason` on the persisted row. Also triggers
 * rating recompute on the parent gastronomy listing.
 *
 * Returns the updated review.
 *
 * @throws 400 if `decision` is not `APPROVED` or `REJECTED`.
 * @throws 403 if the actor lacks `COMMERCE_MODERATE_REVIEW`.
 * @throws 404 if the review does not exist.
 */
export const adminModerateGastronomyReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate a gastronomy review (admin)',
    description:
        'Approves or rejects a gastronomy review. Sets moderationState, moderatedById, ' +
        'moderatedAt, and optionally moderationReason. Triggers rating recompute on the listing. ' +
        'Requires COMMERCE_MODERATE_REVIEW.',
    tags: ['Gastronomy Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ReviewModerateInputSchema,
    responseSchema: GastronomyReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { decision, reason } = ReviewModerateInputSchema.parse(body);

        const result = await gastronomyReviewService.moderateReview(
            { id, decision, reason },
            actor
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
