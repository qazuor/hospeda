/**
 * Provider self-service endpoints for their OWN directory listing
 * (HOS-278 AC-7 .. AC-10).
 *
 * ```
 * GET   /api/v1/protected/host-trades/mine
 * PATCH /api/v1/protected/host-trades/mine
 * ```
 *
 * Both are gated on authentication ONLY — no `HOST_TRADE_*` permission. That
 * is AC-7 and it is deliberate: a provider is an ordinary tourist account
 * whose alliance application was approved, so requiring `HOST_TRADE_VIEW`
 * (the host-directory reading perk) would lock them out of their own ficha.
 * The service scopes every read and write to `ownerUserId = actor.id`.
 *
 * Note the path carries no id. There is nothing to address but your own
 * listing, which is what makes AC-10 ("a provider cannot read or edit
 * another's") structural rather than a check.
 *
 * Actor-dependent, therefore NOT cacheable. No `cacheTTL`, and neither may be
 * moved to the public tier.
 *
 * @module routes/host-trade/protected/mine
 */

import { HostTradeOwnerUpdateSchema, HostTradeOwnerViewSchema } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * Response shape for both endpoints.
 *
 * `trade` is nullable because owning no listing is an ordinary state, not an
 * error: a 404 would make "your application was approved but the listing is
 * not built yet" look like a broken page, and a 403 would confirm a listing
 * exists. The PATCH route never answers null — it 404s, because editing
 * something that does not exist IS a client mistake.
 */
const MyHostTradeResponseSchema = z.object({
    trade: HostTradeOwnerViewSchema.nullable()
});

/**
 * Handler for the read. Exported standalone so it is unit-testable against a
 * mocked `Context` without booting Hono.
 */
export async function handleGetMyHostTrade(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await hostTradeService.getOwn(actor);

    if (result.error) {
        // `getOwn` has no gated failure path — no permission check, and "no
        // listing" is null rather than an error — so an error here is something
        // unexpected. Failing beats answering null, which would read as "you
        // have no listing" on the one page whose job is showing it.
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { trade: result.data?.trade ?? null };
}

/** Handler for the edit. Exported standalone for the same reason. */
export async function handleUpdateMyHostTrade(ctx: Context, body: unknown) {
    const actor = getActorFromContext(ctx);

    const result = await hostTradeService.updateOwn(
        actor,
        body as Parameters<typeof hostTradeService.updateOwn>[1]
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { trade: result.data?.trade ?? null };
}

/**
 * GET /api/v1/protected/host-trades/mine
 *
 * The caller's own directory listing, or `null`. Auth-only — see module
 * docstring for why no `HOST_TRADE_*` permission is required.
 */
export const protectedGetMyHostTradeRoute = createProtectedRoute({
    method: 'get',
    path: '/mine',
    summary: "Get the caller's own host-trade listing",
    description:
        'Returns the directory listing owned by the authenticated caller, or null when they own none — never 404, never 403. Auth-only; no HOST_TRADE_* permission required, because an approved service provider is an ordinary account (HOS-278 AC-7).',
    tags: ['HostTrades'],
    responseSchema: MyHostTradeResponseSchema,
    handler: async (ctx: Context) => handleGetMyHostTrade(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});

/**
 * PATCH /api/v1/protected/host-trades/mine
 *
 * Edits the caller's own listing. Operational fields apply immediately; a
 * benefit change is parked for admin review (AC-8). Identity fields are absent
 * from the request schema, so they are stripped rather than rejected (AC-9).
 */
export const protectedUpdateMyHostTradeRoute = createProtectedRoute({
    method: 'patch',
    path: '/mine',
    summary: "Update the caller's own host-trade listing",
    description:
        'Updates the operational fields (contact, schedule) of the listing owned by the authenticated caller, applied immediately. A benefit change is stored as a pending edit and awaits admin review before the directory shows it. Identity fields (name, slug, category, destination, visibility) are not accepted and are silently discarded.',
    tags: ['HostTrades'],
    requestBody: HostTradeOwnerUpdateSchema,
    responseSchema: MyHostTradeResponseSchema,
    handler: async (ctx: Context, _params: unknown, body: unknown) =>
        handleUpdateMyHostTrade(ctx, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
