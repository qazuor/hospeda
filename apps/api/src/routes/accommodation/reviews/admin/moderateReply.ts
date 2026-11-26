/**
 * Admin moderation of a host's reply to an accommodation review (HOS-2199).
 *
 * A reply publishes at once, so this is the after-the-fact control: `REJECTED`
 * hides it from the public page, `APPROVED` releases one the filter held.
 *
 * @route POST /api/v1/admin/accommodations/reviews/replies/:id/moderate
 */
import {
    AccommodationReviewIdSchema,
    AccommodationReviewReplySchema,
    PermissionEnum,
    ReviewModerateInputSchema
} from '@repo/schemas';
import { AccommodationReviewReplyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const replyService = new AccommodationReviewReplyService({ logger: apiLogger });

export const adminModerateAccommodationReviewReplyRoute = createAdminRoute({
    method: 'post',
    path: '/replies/{id}/moderate',
    summary: 'Moderate a host reply to an accommodation review (admin)',
    description:
        'Approves or rejects (hides) a host reply. Requires ACCOMMODATION_REVIEW_MODERATE.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE],
    requestParams: { id: AccommodationReviewIdSchema },
    requestBody: ReviewModerateInputSchema,
    responseSchema: AccommodationReviewReplySchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { decision, reason } = ReviewModerateInputSchema.parse(body);
        const result = await replyService.moderateReply({
            id: params.id as string,
            decision,
            reason,
            actor
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data.reply;
    }
});
