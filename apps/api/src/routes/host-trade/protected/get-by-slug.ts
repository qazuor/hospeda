/**
 * The single-provider read the QR landing page runs on (HOS-376 T-045).
 *
 * ```
 * GET /api/v1/protected/host-trades/{slug}
 * ```
 *
 * WHY THIS EXISTS, given a directory list already does. The list
 * (`GET /protected/host-trades`) is scoped to the destinations of the caller's
 * own accommodations and takes no slug filter, so it can answer neither
 * question the landing page has to answer:
 *
 * - A QR is a sticker on a van. It carries no destination, so the provider it
 *   names may legitimately sit outside the host's own destinations and still be
 *   the provider who just did the work.
 * - A revoked listing and a listing belonging to somebody else's destination
 *   are the SAME observation in that list — absent. The page has to distinguish
 *   them, because "this provider was taken down" and "no such provider" send the
 *   host to different places.
 *
 * So the two verdicts are two statuses: 404 and 422 `PROVIDER_REVOKED`.
 *
 * A suspension is deliberately NOT a third one. `declarationSuspended*` is
 * excluded from `HostTradePublicSchema` on purpose — a suspension freezes the
 * listing, it is not a public verdict about a person, and "suspendido por
 * declarar usos falsos" is not something a read endpoint should say to every
 * host who scans a code. It surfaces where the actor is actually trying to act:
 * the declaration POST, which answers 403 `DECLARATION_SUSPENDED`. The landing
 * page renders that refusal from the POST rather than pre-empting it here.
 *
 * Addressing by SLUG rather than id matches the QR: the code encodes a URL a
 * human may end up reading off a sticker, and `host_trades.slug` is UNIQUE.
 * Everything else in the domain addresses providers by uuid.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/get-by-slug
 */

import { HostTradePublicResponseSchema, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * Reads one provider by slug, refusing a delisted one.
 *
 * Exported standalone so it is unit-testable against a mocked `Context`
 * without booting Hono, matching `handleDeclareUsageBySlug`.
 *
 * The full entity is handed back untouched: `HostTradePublicResponseSchema`
 * on the route is what projects it down to the host-facing shape, the same
 * contract the directory list route relies on. There is no second, hand-rolled
 * allowlist here to drift from that one.
 */
export async function handleGetHostTradeBySlug(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const slug = params.slug as string;

    const found = await hostTradeService.getByField(actor, 'slug', slug);

    if (found.error) {
        throw new ServiceError(found.error.code, found.error.message);
    }

    // A soft-deleted listing answers 404 rather than 422: from the host's side
    // it was never a listing at all, and there is no sticker in the world
    // pointing at one. `getByField` is expected to filter these out already —
    // this guard is what keeps that true if the read path ever stops doing so.
    if (!found.data || found.data.deletedAt) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    // Revoked is the case a QR genuinely reaches: the row survives a take-down
    // (HOS-278 R-4), so the host holding last season's flyer gets told what
    // happened instead of a bare 404.
    if (found.data.revokedAt) {
        throw new ServiceError(
            ServiceErrorCode.PROVIDER_REVOKED,
            'This provider is no longer listed'
        );
    }

    return { hostTrade: found.data };
}

/**
 * GET /api/v1/protected/host-trades/{slug}
 *
 * Gated on `HOST_TRADE_VIEW` — the directory's own gate, and the same one the
 * declaration POST carries. A visitor who is not a host cannot read a provider
 * off a scanned code any more than they could declare a usage with one.
 *
 * REGISTRATION ORDER MATTERS for this route specifically: `/{slug}` and the
 * literal `GET /mine` are both one segment long, so `mine` is a candidate slug.
 * It is registered after every literal sibling in `protected/index.ts`, and
 * `test/routes/host-trade/get-by-slug.test.ts` asserts by request that `/mine`
 * still reaches the own-listing handler.
 */
export const protectedGetHostTradeBySlugRoute = createProtectedRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Read one directory provider by slug',
    description:
        'Returns the host-facing view of a single directory provider, addressed by the slug a QR encodes. Backs the usage-registration landing page. Answers 404 when no listing carries the slug and 422 PROVIDER_REVOKED when the listing was taken down, so the page can tell the two apart. A declaration suspension is not reported here — it surfaces on the declaration POST.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW],
    requestParams: { slug: z.string().min(1) },
    responseSchema: HostTradePublicResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetHostTradeBySlug(ctx, params),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
