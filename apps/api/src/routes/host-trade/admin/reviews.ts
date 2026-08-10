/**
 * Admin moderation of host-trade reviews and replies (HOS-376 T-037).
 *
 * ```
 * GET  /api/v1/admin/host-trades/reviews
 * POST /api/v1/admin/host-trades/reviews/{id}/moderate
 * GET  /api/v1/admin/host-trades/replies
 * POST /api/v1/admin/host-trades/replies/{id}/moderate
 * ```
 *
 * TWO QUEUES, TWO MEANINGS. A review is born APPROVED (§6.4), so its pending
 * pile is BACKLOG: nothing is blocked while it sits there. A reply is born
 * PENDING, so its pile is providers who cannot answer a complaint about their
 * own business until a human clears them. The screens are separate for that
 * reason and so is the badge — see
 * `routes/moderation/admin/host-trade-reviews-pending-count.ts`.
 *
 * NEITHER LISTING FORCES A MODERATION STATE, which is the opposite of the
 * directory listing next door. A queue that could only show what is already
 * published would have nothing to moderate.
 *
 * @module routes/host-trade/admin/reviews
 */

import {
    HostTradeReviewAdminSchema,
    HostTradeReviewAdminSearchSchema,
    HostTradeReviewReplyAdminSchema,
    HostTradeReviewReplyAdminSearchSchema,
    ModerationStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import {
    HostTradeReviewReplyService,
    HostTradeReviewService,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';

const reviewService = new HostTradeReviewService({ logger: apiLogger });
const replyService = new HostTradeReviewReplyService({ logger: apiLogger });

/**
 * Body of a moderation decision.
 *
 * Only the two verdicts. `PENDING` is a STATE, not a decision — offering it
 * here would let a moderator park something back in the queue without a record
 * of who moved it or why, which is the one thing the moderation columns exist
 * to prevent.
 */
const ModerateBodySchema = z
    .object({
        decision: z.enum([ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED]),
        reason: z.string().max(1000).optional()
    })
    .strict();

/** GET /api/v1/admin/host-trades/reviews */
export const adminListHostTradeReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/reviews',
    summary: 'List host-trade reviews (admin)',
    description:
        'Returns a paginated list of host-trade reviews in every moderation state, for the moderation queue. Reviews are published on creation, so this queue is a backlog rather than a gate: nothing is waiting on it.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL],
    requestQuery: HostTradeReviewAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: HostTradeReviewAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await reviewService.adminList(actor, query ?? {});
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});

/**
 * POST /api/v1/admin/host-trades/reviews/{id}/moderate
 *
 * Taking a review down changes what the public card says, so the service
 * recomputes the listing's aggregates in the same transaction (AC-27).
 */
export const adminModerateHostTradeReviewRoute = createAdminRoute({
    method: 'post',
    path: '/reviews/{id}/moderate',
    summary: 'Moderate a host-trade review',
    description:
        'Approves or rejects a host-trade review, recording who decided and why. Rejecting removes it from the directory and from the provider’s public average in the same transaction, so the card can never show a count that includes a review nobody can read.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_MODERATE],
    requestParams: { id: z.string().uuid() },
    requestBody: ModerateBodySchema,
    responseSchema: z.object({ review: HostTradeReviewAdminSchema }),
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const actor = getActorFromContext(ctx);
        const { decision, reason } = body as z.infer<typeof ModerateBodySchema>;

        const result = await reviewService.moderateReview({
            id: params.id as string,
            decision,
            reason,
            actor
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { review: result.data?.review };
    }
});

/** GET /api/v1/admin/host-trades/replies */
export const adminListHostTradeRepliesRoute = createAdminListRoute({
    method: 'get',
    path: '/replies',
    summary: 'List host-trade review replies (admin)',
    description:
        'Returns a paginated list of provider replies in every moderation state. Unlike the review queue, this one BLOCKS publication: a reply stays out of the directory until it is approved, so a provider waiting here cannot answer a complaint about his business.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL],
    requestQuery: HostTradeReviewReplyAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: HostTradeReviewReplyAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await replyService.adminList(actor, query ?? {});
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});

/**
 * POST /api/v1/admin/host-trades/replies/{id}/moderate
 *
 * No aggregate recount here, deliberately: a reply is not counted anywhere, so
 * recomputing would be three queries that cannot change a number.
 */
export const adminModerateHostTradeReplyRoute = createAdminRoute({
    method: 'post',
    path: '/replies/{id}/moderate',
    summary: 'Moderate a host-trade review reply',
    description:
        'Approves or rejects a provider’s reply, recording who decided and why. Approving is what publishes it under the review. The decision reaches its author by email, including the reason for a rejection.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_MODERATE],
    requestParams: { id: z.string().uuid() },
    requestBody: ModerateBodySchema,
    responseSchema: z.object({ reply: HostTradeReviewReplyAdminSchema }),
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const actor = getActorFromContext(ctx);
        const { decision, reason } = body as z.infer<typeof ModerateBodySchema>;

        const result = await replyService.moderateReply({
            id: params.id as string,
            decision,
            reason,
            actor
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { reply: result.data?.reply };
    }
});
