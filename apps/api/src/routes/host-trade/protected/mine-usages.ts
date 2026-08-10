/**
 * The provider's side of the benefit-usage record (HOS-376 T-031).
 *
 * ```
 * POST /api/v1/protected/host-trades/mine/usages
 * GET  /api/v1/protected/host-trades/mine/usages
 * GET  /api/v1/protected/host-trades/mine/linked-hosts
 * ```
 *
 * Authorised by ROW OWNERSHIP and nothing else, exactly like `/mine`: an
 * approved provider is an ordinary account that holds no `HOST_TRADE_*`
 * permission, so requiring one would lock them out of their own listing
 * (HOS-278 AC-7). The path carries no id — there is nothing to address but your
 * own listing, which is what makes "a provider cannot touch another's"
 * structural rather than a check.
 *
 * Owning no listing answers 404 here, unlike `GET /mine` which answers `null`:
 * reading your (possibly absent) ficha is an ordinary state, but declaring a
 * usage from a listing that does not exist is a client mistake.
 *
 * Actor-dependent, therefore NOT cacheable.
 *
 * @module routes/host-trade/protected/mine-usages
 */

import {
    HostTradeBenefitUsageProtectedSchema,
    HostTradeBenefitUsageProviderCreateBodySchema,
    HostTradeUsageStatusEnumSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { HostTradeService, HostTradeUsageService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { providerDeclarationRateLimit } from '../../../middlewares/host-trade-rate-limits';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute, createProtectedRoute } from '../../../utils/route-factory';

const usageService = new HostTradeUsageService({ logger: apiLogger });
const hostTradeService = new HostTradeService({ logger: apiLogger });

/** Response shape of the provider's declaration. */
const DeclaredUsageResponseSchema = z.object({
    usage: HostTradeBenefitUsageProtectedSchema
});

/**
 * One entry of the scoped host selector.
 *
 * Id and a display name, never an email. The selector's privacy property is
 * that it lists nobody the provider has not already served — but "already
 * served" is not consent to hand over a stored address. A provider who needs
 * the email channel already has the email; what he must not get is an export of
 * every past client's contact details.
 */
const LinkedHostSchema = z.object({
    id: z.string().uuid(),
    displayName: z.string()
});

/** Resolves the caller's own listing, or 404. */
async function requireOwnListing(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const own = await hostTradeService.getOwn(actor);
    if (own.error) {
        throw new ServiceError(own.error.code, own.error.message);
    }
    if (!own.data?.trade) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    return { actor, trade: own.data.trade };
}

/**
 * Declares a usage from the provider side. Exported standalone for testability.
 *
 * The body is re-parsed HERE, against the same schema the route declares, and
 * that is not belt-and-braces — it is the only thing enforcing "exactly one
 * host identifier". In Zod 4 a `.superRefine()` on an object returns a
 * `ZodObject` and `_def.typeName` is gone, so the route factory's Zod-3-era
 * `typeName === 'ZodEffects'` probe reads the schema as plain and rebuilds it
 * through `createOpenAPISchema()`, dropping the refinement. Without this parse
 * a body carrying BOTH identifiers reaches the service, which refuses it too —
 * so the rule holds either way, but the refusal would come from the wrong layer
 * and after a database round trip.
 */
export async function handleDeclareUsageAsProvider(ctx: Context, body: unknown) {
    const parsed = HostTradeBenefitUsageProviderCreateBodySchema.safeParse(body);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues[0]?.message ?? 'Invalid body'
        );
    }

    const { actor, trade } = await requireOwnListing(ctx);
    const input = parsed.data as {
        servicedAt: string;
        note?: string;
        hostUserId?: string;
        hostEmail?: string;
    };

    const result = await usageService.declareAsProvider(
        {
            hostTradeId: trade.id,
            hostUserId: input.hostUserId,
            hostEmail: input.hostEmail,
            servicedAt: input.servicedAt,
            note: input.note
        },
        actor
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { usage: result.data?.usage };
}

/** Lists the provider's own usages. Exported standalone for testability. */
export async function handleListOwnUsages(ctx: Context, query: Record<string, unknown>) {
    const { actor, trade } = await requireOwnListing(ctx);
    const { page, pageSize } = extractPaginationParams(query ?? {});

    const result = await usageService.listForProvider(
        {
            hostTradeId: trade.id,
            status: query.status as never,
            page,
            pageSize
        },
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

/** Lists the hosts the provider may declare on. Exported standalone. */
export async function handleListLinkedHosts(ctx: Context) {
    const { actor, trade } = await requireOwnListing(ctx);

    const result = await usageService.listLinkedHosts({ hostTradeId: trade.id }, actor);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { hosts: result.data?.hosts ?? [] };
}

/**
 * POST /api/v1/protected/host-trades/mine/usages
 *
 * The provider's two channels (§6.2b selector, §6.2c email). The body carries
 * EXACTLY ONE host identifier; the schema refuses zero or both rather than
 * letting the server pick a winner.
 */
export const protectedDeclareUsageAsProviderRoute = createProtectedRoute({
    method: 'post',
    path: '/mine/usages',
    summary: 'Declare a benefit usage on one of your hosts',
    description:
        'Records that a host used the caller’s benefit. The host is identified by exactly one of hostUserId (from the scoped selector) or hostEmail (the first-time fallback). An email that resolves to nobody, or to somebody who is not a host, answers 404 HOST_NOT_FOUND explicitly — a typo is the common failure and hiding it costs the provider a thirty-day wait on a row that was never going to resolve.',
    tags: ['HostTrades'],
    requestBody: HostTradeBenefitUsageProviderCreateBodySchema,
    responseSchema: DeclaredUsageResponseSchema,
    handler: async (ctx: Context, _params: unknown, body: unknown) =>
        handleDeclareUsageAsProvider(ctx, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 },
        // The channel-aware budget (T-039): the email fallback is the spray
        // vector, so it runs out long before the selector does.
        middlewares: [providerDeclarationRateLimit]
    }
});

/**
 * GET /api/v1/protected/host-trades/mine/usages
 *
 * Every usage on the caller's listing, whatever its state, newest first.
 * Filterable by `status` so the provider can work his pending queue.
 */
export const protectedListOwnUsagesRoute = createProtectedListRoute({
    method: 'get',
    path: '/mine/usages',
    summary: 'List the usages on your own listing',
    description:
        'Returns the benefit usages recorded against the caller’s own directory listing, newest first, optionally filtered by status.',
    tags: ['HostTrades'],
    requestQuery: {
        status: HostTradeUsageStatusEnumSchema.optional()
    },
    responseSchema: HostTradeBenefitUsageProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListOwnUsages(ctx, query ?? {}),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});

/**
 * GET /api/v1/protected/host-trades/mine/linked-hosts
 *
 * The selector's contents: only hosts with a CONFIRMED usage on this listing.
 * That scope IS the privacy property — it lists nobody the provider has not
 * already served, so it cannot be used to browse the host base.
 */
export const protectedListLinkedHostsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/linked-hosts',
    summary: 'List the hosts you may declare on directly',
    description:
        'Returns the hosts who already confirmed a usage with the caller’s listing, for the declaration selector. Scoped to confirmed pairs only: it exposes nobody the provider has not already served, and it never returns an email address.',
    tags: ['HostTrades'],
    responseSchema: z.object({ hosts: z.array(LinkedHostSchema) }),
    handler: async (ctx: Context) => handleListLinkedHosts(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
