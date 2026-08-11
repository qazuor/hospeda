/**
 * The shared usage transitions (HOS-376 T-033).
 *
 * ```
 * POST /api/v1/protected/host-trades/usages/{id}/confirm
 * POST /api/v1/protected/host-trades/usages/{id}/reject
 * POST /api/v1/protected/host-trades/usages/{id}/reject/undo
 * ```
 *
 * ONE PAIR OF ENDPOINTS FOR BOTH SIDES. The route does not know, and must not
 * ask, whether the caller is a host or a provider: `declaredBy` on the row
 * decides who the counterpart is, and the service resolves it. An endpoint that
 * branched on the actor's role would have to answer "which role am I here?" —
 * a question with no answer for the account that is both a host and a provider,
 * which spec §6.2 explicitly supports.
 *
 * EVERY FOREIGN PATH ANSWERS 404, never 403 — a usage that is not yours, a
 * usage you declared yourself (AC-6), a usage that does not exist. A 403 would
 * confirm the id exists and turn these into an oracle, following the criterion
 * of `alliance/protected/claim.ts`.
 *
 * Auth-only: the row's own `declaredBy` and ownership decide everything, so a
 * permission could only decide whether someone may answer a confirmation
 * addressed to them.
 *
 * @module routes/host-trade/protected/usage-transitions
 */

import {
    HostTradeBenefitUsageProtectedSchema,
    HostTradeBenefitUsageRejectBodySchema
} from '@repo/schemas';
import { HostTradeUsageService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { notifyUsageConfirmed, notifyUsageRejected } from '../../../lib/host-trade-notifications';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const usageService = new HostTradeUsageService({ logger: apiLogger });

/** Response shape shared by the three transitions. */
const UsageTransitionResponseSchema = z.object({
    usage: HostTradeBenefitUsageProtectedSchema
});

const usageIdParam = { id: z.string().uuid() };

/** Confirms a pending usage. Exported standalone for testability. */
export async function handleConfirmUsage(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);

    const result = await usageService.confirmUsage({ usageId: params.id as string }, actor);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // Fire-and-forget (T-041): tells the declarant, and invites the review
    // when the declarant is the one who may write it.
    if (result.data?.usage) {
        void notifyUsageConfirmed(result.data.usage as never);
    }

    return { usage: result.data?.usage };
}

/** Rejects a pending usage. Exported standalone for testability. */
export async function handleRejectUsage(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const note = (body as { note?: string } | undefined)?.note;

    const result = await usageService.rejectUsage({ usageId: params.id as string, note }, actor);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // Fire-and-forget (T-041). A rejection blocks that side from re-declaring
    // on the pair, so the declarant cannot be left to infer it from a row that
    // quietly stopped counting.
    if (result.data?.usage) {
        void notifyUsageRejected(result.data.usage as never, note);
    }

    return { usage: result.data?.usage };
}

/** Reverts a rejection. Exported standalone for testability. */
export async function handleUndoRejection(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);

    const result = await usageService.undoRejection({ usageId: params.id as string }, actor);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { usage: result.data?.usage };
}

/**
 * POST /api/v1/protected/host-trades/usages/{id}/confirm
 *
 * Only the counterpart may confirm — including against the declarant, who gets
 * 404 rather than a refusal that admits the row exists (AC-6).
 */
export const protectedConfirmUsageRoute = createProtectedRoute({
    method: 'post',
    path: '/usages/{id}/confirm',
    summary: 'Confirm a benefit usage',
    description:
        'Confirms a PENDING usage. Only the counterpart of whoever declared it may do so — the service resolves which side that is from the row, so the endpoint works identically for a host and for a provider. Anything else answers 404, including the declarant confirming their own declaration.',
    tags: ['HostTrades'],
    requestParams: usageIdParam,
    responseSchema: UsageTransitionResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleConfirmUsage(ctx, params),
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});

/**
 * POST /api/v1/protected/host-trades/usages/{id}/reject
 *
 * The note stays OPTIONAL. Rejection is the control that keeps the public
 * counter honest (§6.5), and requiring a written explanation to say "that never
 * happened" puts friction on the one action the system most needs people to
 * take.
 */
export const protectedRejectUsageRoute = createProtectedRoute({
    method: 'post',
    path: '/usages/{id}/reject',
    summary: 'Reject a benefit usage',
    description:
        'Rejects a PENDING usage, optionally with a note. Only the counterpart may do so; anything else answers 404. A rejection blocks that side from re-declaring on the pair, and enough rejections inside the window suspend the provider’s ability to declare at all.',
    tags: ['HostTrades'],
    requestParams: usageIdParam,
    requestBody: HostTradeBenefitUsageRejectBodySchema,
    responseSchema: UsageTransitionResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleRejectUsage(ctx, params, body),
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});

/**
 * POST /api/v1/protected/host-trades/usages/{id}/reject/undo
 *
 * Restricted to the account that rejected it, NOT merely to the counterpart:
 * the counterpart rule alone would let the rejected party undo the rejection
 * aimed at them, which is what keeps rejecting non-punitive and safe to use.
 */
export const protectedUndoRejectionRoute = createProtectedRoute({
    method: 'post',
    path: '/usages/{id}/reject/undo',
    summary: 'Undo a rejection',
    description:
        'Returns a REJECTED usage to PENDING and clears the pair block. Only the account that rejected it may undo — not merely the counterpart, or the rejected party could reverse a refusal aimed at them.',
    tags: ['HostTrades'],
    requestParams: usageIdParam,
    responseSchema: UsageTransitionResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleUndoRejection(ctx, params),
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});
