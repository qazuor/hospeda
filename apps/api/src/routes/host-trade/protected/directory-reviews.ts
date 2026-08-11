/**
 * The directory's review listing (HOS-376 T-036).
 *
 * ```
 * GET /api/v1/protected/host-trades/{id}/reviews
 * ```
 *
 * What a signed-in host reads on a provider's card: the approved reviews, each
 * with its author and — only when an admin has cleared it — the provider's
 * answer.
 *
 * THE ENDPOINT DECLARES NO MODERATION FILTER, and that absence is the design.
 * A caller cannot express `?moderationState=PENDING`, so nothing arrives at the
 * service's filter spread to be overridden; the service forces APPROVED anyway,
 * as the layer that owns the rule. Two independent refusals, and the outer one
 * is the one that makes the inner unreachable.
 *
 * Gated on `HOST_TRADE_VIEW` because these rows ARE the directory, which is the
 * host perk. Note the consequence, which is deliberate: a provider reading the
 * reviews of his OWN listing holds no such permission and does not go through
 * here — that is `/mine/reviews` (spec §7.5), a different endpoint.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/directory-reviews
 */

import {
    HostTradeReviewProtectedSchema,
    HostTradeReviewReplyProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const reviewService = new HostTradeReviewService({ logger: apiLogger });

/**
 * One row of the listing.
 *
 * The author carries a display name and an image, never an email — the same
 * line the linked-hosts selector draws. `reply` is nullable because most
 * reviews have no answer, and because an answer still in moderation reads as no
 * answer here.
 */
const DirectoryReviewSchema = z.object({
    review: HostTradeReviewProtectedSchema,
    author: z
        .object({
            id: z.string().uuid(),
            displayName: z.string().nullable(),
            image: z.string().nullable()
        })
        .nullable(),
    reply: HostTradeReviewReplyProtectedSchema.nullable()
});

/** Reads a provider's public reviews. Exported standalone for testability. */
export async function handleListProviderReviews(
    ctx: Context,
    params: Record<string, unknown>,
    query: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query ?? {});

    const result = await reviewService.listForDirectory(
        { hostTradeId: params.id as string, page, pageSize },
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
 * GET /api/v1/protected/host-trades/{id}/reviews
 *
 * Newest first. The page window is the only thing a caller may steer.
 */
export const protectedListProviderReviewsRoute = createProtectedListRoute({
    method: 'get',
    path: '/{id}/reviews',
    summary: 'List a provider’s reviews',
    description:
        'Returns the approved reviews of one provider, newest first, each with the host who wrote it and the provider’s answer when that answer has itself been approved. A review awaiting moderation is not listed; an answer awaiting moderation is omitted without hiding the review it answers.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW],
    requestParams: { id: z.string().uuid() },
    responseSchema: DirectoryReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListProviderReviews(ctx, params, query ?? {}),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
