/**
 * Protected host-trade list endpoint
 * Returns active host-trade directory entries scoped to the calling host's
 * accommodation destinations. Only authenticated hosts with HOST_TRADE_VIEW
 * may call this endpoint. Returns an empty array (not an error) when the host
 * has no accommodations yet.
 */
import {
    HostTradeCategoriesFilterSchema,
    HostTradePublicSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * GET /api/v1/protected/host-trades
 * List host-trade entries for the authenticated host — Protected endpoint.
 *
 * Results are scoped server-side to the destination IDs derived from the
 * caller's own accommodations. An authenticated host with no accommodations
 * receives a 200 with an empty `data` array. Unauthenticated requests receive
 * 401; authenticated actors without HOST_TRADE_VIEW receive 403.
 *
 * The optional `categories` query param (HOS-919, AC-5.4) is a comma-separated
 * list of catalog slugs, any-of: a provider holding at least one of them
 * matches, once. Unknown slugs match nothing, so a list of only unknown slugs
 * answers 200 with an empty list. Absent or empty means no filter.
 */
export const protectedListHostTradesRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List host-trade entries for the authenticated host',
    description:
        "Returns active host-trade directory entries scoped to the calling host's accommodation destinations. Requires HOST_TRADE_VIEW permission.",
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW],
    requestQuery: {
        categories: HostTradeCategoriesFilterSchema
    },
    responseSchema: z.array(HostTradePublicSchema),
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const categories = (query as { categories?: readonly string[] } | undefined)?.categories;

        const result = await hostTradeService.listForHost(actor, undefined, { categories });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.trades ?? [];
    }
});
