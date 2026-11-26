/**
 * Reviews received on the authenticated owner's accommodations (HOS-2199).
 * Feeds the `/mi-cuenta/` section where the host answers them.
 * @route GET /api/v1/protected/users/me/received-reviews
 */
import {
    OwnerReceivedReviewSchema,
    OwnerReceivedReviewsQuerySchema,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationReviewReplyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { readEffectiveKeys } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { resolveReviewerDisplayName } from '../../../utils/reviewer-display-name';
import { createProtectedRoute } from '../../../utils/route-factory';

const replyService = new AccommodationReviewReplyService({ logger: apiLogger });

const ReceivedReviewsResponseSchema = z.object({
    items: z.array(OwnerReceivedReviewSchema),
    total: z.number(),
    /**
     * Whether the owner's plan sells `respond_reviews`. The page hides the reply
     * button behind an upsell when false; the write routes enforce it regardless.
     */
    canRespond: z.boolean()
});

export const userReceivedReviewsRoute = createProtectedRoute({
    method: 'get',
    path: '/me/received-reviews',
    summary: 'List reviews received on own accommodations',
    description:
        'Paginated reviews (publicly visible ones) on the accommodations the caller owns, each with its live reply. Filter with unanswered=true.',
    tags: ['Users', 'Reviews'],
    requestQuery: OwnerReceivedReviewsQuerySchema.shape,
    responseSchema: ReceivedReviewsResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const parsed = OwnerReceivedReviewsQuerySchema.parse(query ?? {});
        const [result, keys] = await Promise.all([
            replyService.listReceived({
                actor,
                page: parsed.page,
                pageSize: parsed.pageSize,
                unanswered: parsed.unanswered,
                accommodationId: parsed.accommodationId
            }),
            readEffectiveKeys({
                userId: actor.id,
                vertical: VerticalEnum.ACCOMMODATION,
                keys: ['respond_reviews']
            })
        ]);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        return {
            items: result.data.items.map((row) => ({
                id: row.id,
                accommodationId: row.accommodationId,
                accommodationName: row.accommodationName,
                accommodationSlug: row.accommodationSlug,
                title: row.title,
                content: row.content,
                averageRating: row.averageRating,
                createdAt: row.createdAt,
                reviewerName: resolveReviewerDisplayName({
                    reviewer: {
                        displayName: row.reviewerDisplayName,
                        firstName: row.reviewerFirstName,
                        lastName: row.reviewerLastName
                    }
                }),
                reply:
                    row.replyId &&
                    row.replyContent &&
                    row.replyModerationState &&
                    row.replyCreatedAt
                        ? {
                              id: row.replyId,
                              reviewId: row.id,
                              content: row.replyContent,
                              moderationState: row.replyModerationState,
                              createdAt: row.replyCreatedAt,
                              editedAt: row.replyEditedAt
                          }
                        : null
            })),
            total: result.data.total,
            canRespond: keys.respond_reviews === true
        };
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
