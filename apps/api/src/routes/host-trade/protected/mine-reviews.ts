/**
 * The provider's own review listing (HOS-376 T-050, spec §7.5).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/reviews
 * ```
 *
 * NOT the same read as `GET /{id}/reviews`, and the difference is why this
 * endpoint exists. The directory listing nulls any reply that is not APPROVED,
 * which is correct for a host browsing providers and wrong for the provider
 * himself: it would tell the author of a reply that what he just wrote does not
 * exist, when it is simply waiting for a moderator. Here the reply carries its
 * `moderationState` and, when it was turned down, the reason.
 *
 * The REVIEW side stays filtered to APPROVED. One still in moderation is not
 * published, and handing it to the person it is about would surface a complaint
 * that may yet be rejected.
 *
 * Authorised by ROW OWNERSHIP and nothing else, exactly like the rest of
 * `/mine/*`: an approved provider is an ordinary account holding no
 * `HOST_TRADE_*` permission (HOS-278 AC-7), so requiring one would lock him out
 * of his own listing. Owning no listing answers 404, matching `/mine/usages`.
 *
 * REGISTRATION ORDER: `/mine/reviews` is a literal path that the parameterised
 * `/{id}/reviews` would otherwise swallow, so it is registered before it in
 * `protected/index.ts` — the same rule the usage routes follow.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/mine-reviews
 */

import {
    HostTradeReviewProtectedSchema,
    ModerationStatusEnumSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { HostTradeReviewService, HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const reviewService = new HostTradeReviewService({ logger: apiLogger });
const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * One row as its subject reads it.
 *
 * The author carries a display name and an image, never an email — the same
 * line the linked-hosts selector draws. The reply carries its moderation state
 * and the rejection reason, which is exactly what the directory shape omits.
 */
const OwnerReviewSchema = z.object({
    review: HostTradeReviewProtectedSchema,
    author: z
        .object({
            id: z.string().uuid(),
            displayName: z.string().nullable(),
            image: z.string().nullable()
        })
        .nullable(),
    reply: z
        .object({
            id: z.string().uuid(),
            content: z.string(),
            moderationState: ModerationStatusEnumSchema,
            moderationReason: z.string().nullable(),
            reviewEditedAfterReply: z.boolean(),
            createdAt: z.coerce.date(),
            updatedAt: z.coerce.date()
        })
        .nullable()
});

/** Reads the caller's own reviews. Exported standalone for testability. */
export async function handleListOwnReviews(ctx: Context, query: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query ?? {});

    const own = await hostTradeService.getOwn(actor);
    if (own.error) {
        throw new ServiceError(own.error.code, own.error.message);
    }
    if (!own.data?.trade) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    const result = await reviewService.listForOwner(
        { hostTradeId: own.data.trade.id, page, pageSize },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return {
        items: result.data?.items ?? [],
        pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
    };
}

/**
 * GET /api/v1/protected/host-trades/mine/reviews
 *
 * Auth + row ownership, no permission. The path carries no id — there is
 * nothing to address but your own listing, which is what makes "a provider
 * cannot read another's" structural rather than a check.
 */
export const protectedListOwnReviewsRoute = createProtectedListRoute({
    method: 'get',
    path: '/mine/reviews',
    summary: 'List the reviews written about your own listing',
    description:
        'Returns the published reviews of the caller’s own directory listing, newest first, each with its author and the caller’s own reply. Unlike the directory listing, the reply is returned in whatever moderation state it is in — including PENDING and REJECTED with its reason — because its author is the one reading. Answers 404 when the caller owns no listing.',
    tags: ['HostTrades'],
    responseSchema: OwnerReviewSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListOwnReviews(ctx, query ?? {}),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
