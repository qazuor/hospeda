/**
 * The provider's own tab counts in ONE read (owner decision 22, Mi cuenta UI
 * epic).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/tab-counts
 * ```
 *
 * `/mi-cuenta/proveedor` shows a count pill on «Usos» (the PENDING usages a
 * host declared, i.e. the provider's inbox) and on «Valoraciones». It used to
 * make two one-row list reads on every tab for them; this endpoint answers
 * both, with the same filters those reads used.
 *
 * Error contract (`apps/api/docs/error-contract.md`): auth-only like every
 * `/mine` route (an approved provider is an ordinary account), 404 when the
 * caller owns no listing. Past that, a count whose own read fails is `null`
 * rather than failing the whole answer: a failed count is not shown, and one
 * broken source must not hide the other.
 *
 * @module routes/host-trade/protected/mine-tab-counts
 */

import {
    HostTradeProviderTabCountsSchema,
    HostTradeUsageDeclaredByEnum,
    HostTradeUsageStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    HostTradeReviewService,
    HostTradeService,
    HostTradeUsageService,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });
const usageService = new HostTradeUsageService({ logger: apiLogger });
const reviewService = new HostTradeReviewService({ logger: apiLogger });

/** One row is enough: only the total is read. */
const COUNT_PAGE = { page: 1, pageSize: 1 } as const;

/**
 * Handler for the tab counts. Exported standalone so it is unit-testable
 * against a mocked `Context` without booting Hono.
 *
 * @param ctx - The Hono request context.
 * @returns `{ pendingUsages, reviews }`, each `null` when its read failed.
 */
export async function handleGetMyTabCounts(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const own = await hostTradeService.getOwn(actor);
    if (own.error) {
        throw new ServiceError(own.error.code, own.error.message);
    }
    const trade = own.data?.trade;
    if (!trade) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    const [usages, reviews] = await Promise.all([
        usageService.listForProvider(
            {
                hostTradeId: trade.id,
                status: HostTradeUsageStatusEnum.PENDING,
                declaredBy: HostTradeUsageDeclaredByEnum.HOST,
                ...COUNT_PAGE
            },
            actor
        ),
        reviewService.listForOwner({ hostTradeId: trade.id, ...COUNT_PAGE }, actor)
    ]);

    if (usages.error) {
        apiLogger.warn({ code: usages.error.code }, '[host-trade] pending usages count failed');
    }
    if (reviews.error) {
        apiLogger.warn({ code: reviews.error.code }, '[host-trade] reviews count failed');
    }

    return {
        pendingUsages: usages.error ? null : (usages.data?.total ?? 0),
        reviews: reviews.error ? null : (reviews.data?.total ?? 0)
    };
}

/** GET /api/v1/protected/host-trades/mine/tab-counts */
export const protectedGetMyTabCountsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/tab-counts',
    summary: 'Count pills of your own provider tabs',
    description:
        'Returns, in one read, the PENDING usages a host declared on the caller’s own listing and the reviews of that listing. Auth-only; 404 when the caller owns no listing. A count whose read fails is null.',
    tags: ['HostTrades'],
    responseSchema: HostTradeProviderTabCountsSchema,
    handler: async (ctx: Context) => handleGetMyTabCounts(ctx),
    options: {
        customRateLimit: { requests: 120, windowMs: 60_000 }
    }
});
