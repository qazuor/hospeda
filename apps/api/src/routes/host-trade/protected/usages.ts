/**
 * The host's side of the benefit-usage record (HOS-376 T-030).
 *
 * ```
 * POST /api/v1/protected/host-trades/{slug}/usages   — the QR path (§6.2a)
 * GET  /api/v1/protected/host-trades/usages/pending
 * GET  /api/v1/protected/host-trades/usages/pending-count
 * ```
 *
 * REGISTRATION ORDER IS LOAD-BEARING. `/usages/pending` is a literal path that
 * `/{slug}/usages` would happily swallow — a request for the inbox would be
 * read as "declare a usage on the provider whose slug is `usages`". Both
 * literal routes are therefore registered BEFORE the parameterised one in
 * `protected/index.ts`, following the destination `by-path` precedent.
 *
 * The declaration takes a SLUG, not an id, because the QR encodes a URL a human
 * may end up reading off a sticker. Everything else in the domain addresses
 * usages by uuid.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/usages
 */

import {
    CountResponseSchema,
    HostTradeBenefitUsageHostCreateBodySchema,
    HostTradeBenefitUsageProtectedSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { HostTradeService, HostTradeUsageService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { notifyUsageDeclared } from '../../../lib/host-trade-notifications';
import { hostDeclarationRateLimit } from '../../../middlewares/host-trade-rate-limits';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute, createProtectedRoute } from '../../../utils/route-factory';

const usageService = new HostTradeUsageService({ logger: apiLogger });
const hostTradeService = new HostTradeService({ logger: apiLogger });

/** Response shape of the declaration. */
const DeclaredUsageResponseSchema = z.object({
    usage: HostTradeBenefitUsageProtectedSchema
});

/**
 * Declares a usage from the host side, addressing the provider by slug.
 *
 * Exported standalone so it is unit-testable against a mocked `Context`
 * without booting Hono.
 */
export async function handleDeclareUsageBySlug(
    ctx: Context,
    params: Record<string, unknown>,
    body: unknown
) {
    const actor = getActorFromContext(ctx);
    const slug = params.slug as string;

    // The slug→id hop is the only thing this route adds over the service. A
    // slug nobody owns answers NOT_FOUND here rather than reaching the service
    // with an id that would not exist either.
    const found = await hostTradeService.getByField(actor, 'slug', slug);
    if (found.error) {
        throw new ServiceError(found.error.code, found.error.message);
    }
    if (!found.data) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    const input = body as { servicedAt: string; note?: string };
    const result = await usageService.declareAsHost(
        { hostTradeId: found.data.id, servicedAt: input.servicedAt, note: input.note },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // Fire-and-forget (T-041): the row is already written, so a transport
    // outage must never turn a recorded usage into a failed request.
    if (result.data?.usage) {
        void notifyUsageDeclared(result.data.usage as never);
    }

    return { usage: result.data?.usage };
}

/** Reads the caller's pending inbox. Exported standalone for testability. */
export async function handleListPendingUsages(ctx: Context, query: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query ?? {});

    const result = await usageService.listPendingForHost({ page, pageSize }, actor);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return {
        items: result.data?.items ?? [],
        pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
    };
}

/** Reads the caller's pending count. Exported standalone for testability. */
export async function handleCountPendingUsages(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await usageService.countPendingForHost(actor);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { count: result.data?.count ?? 0 };
}

/**
 * POST /api/v1/protected/host-trades/{slug}/usages
 *
 * Gated on `HOST_TRADE_VIEW`, the directory's own gate. That is what makes the
 * weakly-verified host-declared branch safe: a passer-by who scans the sticker
 * on a van is not a host, so the usage they would declare cannot be created,
 * let alone ripen into a review (spec §6.5).
 */
export const protectedDeclareUsageRoute = createProtectedRoute({
    method: 'post',
    path: '/{slug}/usages',
    summary: 'Declare a benefit usage with a provider (QR path)',
    description:
        'Records that the authenticated host used a provider’s benefit, addressing the provider by the slug the QR encodes. The usage is created PENDING and awaits the provider’s confirmation. Answers 422 PROVIDER_REVOKED for a delisted provider, 403 DECLARATION_SUSPENDED for a suspended one, 403 DECLARATION_BLOCKED when a standing rejection blocks the pair, and 409 USAGE_PENDING_EXISTS when one is already open.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW],
    requestParams: { slug: z.string().min(1) },
    requestBody: HostTradeBenefitUsageHostCreateBodySchema,
    responseSchema: DeclaredUsageResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) =>
        handleDeclareUsageBySlug(ctx, params, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 },
        // A typo guard rather than a defence: this is the host declaring about
        // himself, behind the directory's own permission (T-039).
        middlewares: [hostDeclarationRateLimit]
    }
});

/**
 * GET /api/v1/protected/host-trades/usages/pending
 *
 * Auth-only: the rows are already scoped to the caller, so a permission would
 * only decide whether a host may read his own inbox.
 */
export const protectedListPendingUsagesRoute = createProtectedListRoute({
    method: 'get',
    path: '/usages/pending',
    summary: 'List the usages awaiting the caller’s confirmation',
    description:
        'Returns the PENDING usages a provider declared about the authenticated host, newest first. Own declarations are excluded — those wait on the provider, not on the caller.',
    tags: ['HostTrades'],
    responseSchema: HostTradeBenefitUsageProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListPendingUsages(ctx, query ?? {}),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});

/**
 * GET /api/v1/protected/host-trades/usages/pending-count
 *
 * Feeds the nav badge, which turns off by RESOLVING rather than by viewing
 * (spec §6.6) — so this counts the same rows the list shows, from the same
 * definition in the model.
 */
export const protectedCountPendingUsagesRoute = createProtectedRoute({
    method: 'get',
    path: '/usages/pending-count',
    summary: 'Count the usages awaiting the caller’s confirmation',
    description:
        'Returns how many PENDING usages await the authenticated host’s confirmation. Backs the navigation badge, which clears by resolving them, not by opening the page.',
    tags: ['HostTrades'],
    responseSchema: CountResponseSchema,
    handler: async (ctx: Context) => handleCountPendingUsages(ctx),
    options: {
        customRateLimit: { requests: 120, windowMs: 60_000 }
    }
});
