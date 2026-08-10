/**
 * The host's review of a provider (HOS-376 T-034).
 *
 * ```
 * POST  /api/v1/protected/host-trades/{id}/reviews
 * PATCH /api/v1/protected/host-trades/reviews/{id}
 * GET   /api/v1/protected/host-trades/{id}/my-review
 * ```
 *
 * THREE ENDPOINTS, THREE DIFFERENT AUTHORISATIONS, and the differences are the
 * design:
 *
 * - Creating is gated on `HOST_TRADE_REVIEW_CREATE` (spec §6.3 gate 1). It is
 *   the only one of the three that decides whether an account may speak about
 *   somebody else at all.
 * - Editing and reading back your own are AUTH-ONLY (§7.5: "auth + ownership").
 *   The row is already scoped to the session, so a permission could only decide
 *   whether a host may touch something he wrote himself — and it would lock out
 *   a host whose directory perk lapsed while his review stayed published.
 *
 * The other three gates of §6.3 — a confirmed usage, not your own listing, a
 * provider still listed — are the SERVICE's, deliberately: they are facts about
 * rows, and a route that pre-checked them would answer from a second, drifting
 * copy of the rule. This file only carries the id from the path and maps the
 * refusal to its number.
 *
 * EDITING A REVIEW THAT IS NOT YOURS ANSWERS 404, never 403. The service
 * refuses with NOT_FOUND for exactly that reason, and this route passes it
 * through unchanged: a 403 would confirm the id exists.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/reviews
 */

import {
    HostTradeReviewCreateBodySchema,
    HostTradeReviewProtectedSchema,
    HostTradeReviewUpdateBodySchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { hostTradeReviewRateLimit } from '../../../middlewares/host-trade-rate-limits';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const reviewService = new HostTradeReviewService({ logger: apiLogger });

/** Response shape of the two write endpoints. */
const ReviewResponseSchema = z.object({
    review: HostTradeReviewProtectedSchema
});

/**
 * Response shape of the read-back.
 *
 * `review` is nullable because having written none is an ordinary state, not
 * an error — the same reasoning as `trade` on `GET /mine`. A 404 would make
 * "you have not reviewed them yet" look like a broken page on the one card
 * whose job is offering to write one.
 */
const MyReviewResponseSchema = z.object({
    review: HostTradeReviewProtectedSchema.nullable()
});

/** The four fields a host authors. */
type ReviewBody = {
    overallRating: number;
    rating?: Record<string, number> | null;
    respectedBenefit: boolean;
    content?: string | null;
};

/** Creates the review. Exported standalone for testability. */
export async function handleCreateReview(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const input = body as ReviewBody;

    const result = await reviewService.createReview(
        { hostTradeId: params.id as string, ...input },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { review: result.data?.review };
}

/**
 * Edits the actor's own review. Exported standalone for testability.
 *
 * The body is spread AS PARSED, not rebuilt field by field: an absent key must
 * stay absent, because that is what tells the service "leave it alone". Padding
 * the untouched fields with `undefined` would make a star-only edit look like a
 * rewrite, and a rewrite is the only thing that re-runs moderation — which
 * would hand a moderator's rejection back as APPROVED.
 */
export async function handleUpdateReview(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const patch = (body ?? {}) as Partial<ReviewBody>;

    const result = await reviewService.updateReview(
        { reviewId: params.id as string, ...patch },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { review: result.data?.review };
}

/** Reads back the actor's own review, or null. Exported standalone. */
export async function handleGetMyReview(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);

    const result = await reviewService.getMyReview({ hostTradeId: params.id as string }, actor);

    if (result.error) {
        // `getMyReview` has no gated failure path — having written no review is
        // `null`, not an error — so anything here is unexpected. Failing beats
        // answering null, which would read as "you have not reviewed them".
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { review: result.data?.review ?? null };
}

/**
 * POST /api/v1/protected/host-trades/{id}/reviews
 *
 * Gated on `HOST_TRADE_REVIEW_CREATE` — the permission the seed grants the
 * `HOST` role. That is gate 1 of §6.3 and the only one this layer owns.
 */
export const protectedCreateReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/reviews',
    summary: 'Review a provider',
    description:
        'Publishes the authenticated host’s review of one provider. Requires a CONFIRMED benefit usage with them (403 NO_CONFIRMED_USAGE), refuses reviewing your own listing (403 SELF_REVIEW_FORBIDDEN), a second review of the same provider (409 REVIEW_ALREADY_EXISTS) and a delisted one (422 PROVIDER_REVOKED). The review is born APPROVED unless automated moderation flags its text.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_REVIEW_CREATE],
    requestParams: { id: z.string().uuid() },
    requestBody: HostTradeReviewCreateBodySchema,
    responseSchema: ReviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleCreateReview(ctx, params, body),
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 },
        // Bounds the cost of hammering the endpoint to discover which
        // host/provider pairs exist (T-039).
        middlewares: [hostTradeReviewRateLimit]
    }
});

/**
 * PATCH /api/v1/protected/host-trades/reviews/{id}
 *
 * Auth + row ownership. Editing somebody else's answers 404.
 */
export const protectedUpdateReviewRoute = createProtectedRoute({
    method: 'patch',
    path: '/reviews/{id}',
    summary: 'Edit your own review',
    description:
        'Rewrites the authenticated host’s own review. Only the fields sent are changed. Changing the TEXT re-runs moderation and can pull the review out of the directory until it is approved again; any existing provider reply survives, marked as answering an earlier version. A review that is not the caller’s answers 404, never 403.',
    tags: ['HostTrades'],
    requestParams: { id: z.string().uuid() },
    requestBody: HostTradeReviewUpdateBodySchema,
    responseSchema: ReviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleUpdateReview(ctx, params, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});

/**
 * GET /api/v1/protected/host-trades/{id}/my-review
 *
 * Backs the provider card's decision between "write a review" and "edit
 * yours", which is why it answers `null` rather than 404.
 */
export const protectedGetMyReviewRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/my-review',
    summary: 'Read back your own review of a provider',
    description:
        'Returns the authenticated host’s review of one provider, or null when they have not written one. Scoped to the session: the path names the provider, never the reviewer.',
    tags: ['HostTrades'],
    requestParams: { id: z.string().uuid() },
    responseSchema: MyReviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetMyReview(ctx, params),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
