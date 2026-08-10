/**
 * The provider's right of reply (HOS-376 T-035).
 *
 * ```
 * POST  /api/v1/protected/host-trades/reviews/{id}/reply
 * PATCH /api/v1/protected/host-trades/replies/{id}
 * ```
 *
 * AUTH-ONLY, both of them, and that is HOS-278 AC-7 rather than an oversight: a
 * provider whose alliance application was approved is an ordinary account
 * holding no `HOST_TRADE_*` permission, so requiring one would silence him on
 * the one page that carries a complaint about his own business. What authorises
 * him is owning the reviewed listing — resolved server-side by the service,
 * which re-derives ownership from the listing rather than trusting the frozen
 * `authorUserId`, so a listing that changed hands does not leave its former
 * owner able to keep editing.
 *
 * ANSWERING SOMEBODY ELSE'S REVIEW IS 404, never 403. The service refuses with
 * NOT_FOUND for that reason and these routes pass it through untouched.
 *
 * BOTH WRITE PATHS LEAVE THE REPLY PENDING and neither says so. Creating takes
 * the state from the column default plus `moderateText()`; editing returns it
 * there explicitly (AC-23). Either way it is the service's decision, and a route
 * that restated it would be a second place to get §6.4 wrong.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/replies
 */

import {
    HostTradeReviewReplyCreateBodySchema,
    HostTradeReviewReplyProtectedSchema,
    HostTradeReviewReplyUpdateBodySchema
} from '@repo/schemas';
import { HostTradeReviewReplyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const replyService = new HostTradeReviewReplyService({ logger: apiLogger });

/** Response shape shared by both endpoints. */
const ReplyResponseSchema = z.object({
    reply: HostTradeReviewReplyProtectedSchema
});

/** Answers a review of the caller's own listing. Exported standalone. */
export async function handleCreateReply(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const { content } = body as { content: string };

    const result = await replyService.createReply(
        { reviewId: params.id as string, content },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { reply: result.data?.reply };
}

/** Rewrites the caller's own reply. Exported standalone. */
export async function handleUpdateReply(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const { content } = body as { content: string };

    const result = await replyService.updateReply({ replyId: params.id as string, content }, actor);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { reply: result.data?.reply };
}

/**
 * POST /api/v1/protected/host-trades/reviews/{id}/reply
 *
 * One reply per review, not a thread: a second attempt answers 409.
 */
export const protectedCreateReplyRoute = createProtectedRoute({
    method: 'post',
    path: '/reviews/{id}/reply',
    summary: 'Answer a review of your listing',
    description:
        'Publishes the provider’s single answer to a review of their own directory listing. The reply is created awaiting moderation and stays out of the directory until an admin clears it — a reply is written by somebody with a wounded commercial interest who was inside the host’s home, which is a disclosure risk the review itself does not carry. A review that is not on the caller’s listing answers 404, and a second reply to the same review answers 409.',
    tags: ['HostTrades'],
    requestParams: { id: z.string().uuid() },
    requestBody: HostTradeReviewReplyCreateBodySchema,
    responseSchema: ReplyResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleCreateReply(ctx, params, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});

/**
 * PATCH /api/v1/protected/host-trades/replies/{id}
 *
 * Editing returns the reply to moderation and WIPES the previous decision: it
 * was made about text that no longer exists (AC-23).
 */
export const protectedUpdateReplyRoute = createProtectedRoute({
    method: 'patch',
    path: '/replies/{id}',
    summary: 'Edit your own reply',
    description:
        'Rewrites the provider’s own reply. The edited text returns to moderation and leaves the directory until it is cleared again, and the previous moderation decision is discarded — it was made about text that no longer exists. A reply that is not the caller’s answers 404, never 403.',
    tags: ['HostTrades'],
    requestParams: { id: z.string().uuid() },
    requestBody: HostTradeReviewReplyUpdateBodySchema,
    responseSchema: ReplyResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleUpdateReply(ctx, params, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
