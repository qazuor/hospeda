/**
 * Host reply to an accommodation review (HOS-2199).
 *
 * POST   /api/v1/protected/accommodations/:accommodationId/reviews/:reviewId/reply
 * PATCH  /api/v1/protected/accommodations/:accommodationId/reviews/:reviewId/reply
 * DELETE /api/v1/protected/accommodations/:accommodationId/reviews/:reviewId/reply
 *
 * Authorization runs through `resolveListingAccess` (`READ_OWN_COMMERCIAL` with the
 * `respond_reviews` entitlement at step 6). The service then re-derives ownership
 * of the review's accommodation and answers 404 for anything that is not the
 * caller's, and for a review that does not belong to the accommodation in the URL.
 */
import {
    AccommodationIdSchema,
    AccommodationReviewIdSchema,
    type AccommodationReviewReply,
    AccommodationReviewReplyBodySchema,
    type AccommodationReviewReplyOwner,
    AccommodationReviewReplyOwnerSchema,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationReviewReplyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/** Entitlement that sells the right to answer reviews. */
const RESPOND_REVIEWS_KEY = 'respond_reviews';

const replyService = new AccommodationReviewReplyService({ logger: apiLogger });

/** 60 reply writes per hour per user: a host answers, they do not bulk-post. */
const writeReplyRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: 3_600_000,
    max: 60,
    keyPrefix: 'prot:write:review-reply'
});

const requestParams = {
    accommodationId: AccommodationIdSchema,
    reviewId: AccommodationReviewIdSchema
};

const listingAccess = {
    vertical: VerticalEnum.ACCOMMODATION,
    operation: 'READ_OWN_COMMERCIAL',
    idParam: 'accommodationId',
    step6Key: RESPOND_REVIEWS_KEY
} as const;

/** POST: write the reply. */
export const protectedCreateReviewReplyRoute = createProtectedRoute({
    method: 'post',
    path: '/{accommodationId}/reviews/{reviewId}/reply',
    summary: 'Reply to a review of an own accommodation',
    description:
        'Publishes the host reply at once; the automatic content filter may hold it as PENDING. One live reply per review. Requires the respond_reviews entitlement.',
    tags: ['Accommodation Reviews'],
    protectedTag: false,
    listingAccess,
    requestParams,
    requestBody: AccommodationReviewReplyBodySchema,
    responseSchema: AccommodationReviewReplyOwnerSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { content } = body as z.infer<typeof AccommodationReviewReplyBodySchema>;
        const accommodationId = params.accommodationId as string;
        const reviewId = params.reviewId as string;
        const result = await replyService.respond({ accommodationId, reviewId, content, actor });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return toOwnerReply(result.data.reply);
    },
    options: { middlewares: [writeReplyRateLimit] }
});

/** PATCH: edit the live reply. */
export const protectedEditReviewReplyRoute = createProtectedRoute({
    method: 'patch',
    path: '/{accommodationId}/reviews/{reviewId}/reply',
    summary: 'Edit the reply to a review of an own accommodation',
    description:
        'Rewrites the live reply, marks it as edited and passes it through the content filter again. Requires the respond_reviews entitlement.',
    tags: ['Accommodation Reviews'],
    protectedTag: false,
    listingAccess,
    requestParams,
    requestBody: AccommodationReviewReplyBodySchema,
    responseSchema: AccommodationReviewReplyOwnerSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { content } = body as z.infer<typeof AccommodationReviewReplyBodySchema>;
        const accommodationId = params.accommodationId as string;
        const reviewId = params.reviewId as string;
        const result = await replyService.editReply({ accommodationId, reviewId, content, actor });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return toOwnerReply(result.data.reply);
    },
    options: { middlewares: [writeReplyRateLimit] }
});

/**
 * Removing one's own reply needs no plan: a host who downgraded must still be
 * able to take down what they published. Ownership is still decided by the
 * listing chain (step 4) and the service.
 *
 * DELETE: soft-delete the live reply.
 */
export const protectedDeleteReviewReplyRoute = createProtectedRoute({
    method: 'delete',
    path: '/{accommodationId}/reviews/{reviewId}/reply',
    summary: 'Delete the reply to a review of an own accommodation',
    description:
        'Soft-deletes the live reply. The host can answer the review again afterwards. Needs no plan entitlement.',
    tags: ['Accommodation Reviews'],
    protectedTag: false,
    listingAccess: {
        vertical: VerticalEnum.ACCOMMODATION,
        operation: 'READ_OWN',
        idParam: 'accommodationId'
    },
    requestParams,
    responseSchema: z.object({ deleted: z.literal(true) }),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.accommodationId as string;
        const reviewId = params.reviewId as string;
        const result = await replyService.deleteReply({ accommodationId, reviewId, actor });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: { middlewares: [writeReplyRateLimit] }
});

/** Projects the stored reply to what its author sees (the schema drops everything else). */
function toOwnerReply(reply: AccommodationReviewReply): AccommodationReviewReplyOwner {
    return AccommodationReviewReplyOwnerSchema.parse({
        ...reply,
        editedAt: reply.editedAt ?? null
    });
}
