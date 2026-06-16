/**
 * Protected host-trade list endpoint
 * Returns active host-trade directory entries scoped to the calling host's
 * accommodation destinations. Only authenticated hosts with HOST_TRADE_VIEW
 * may call this endpoint. Returns an empty array (not an error) when the host
 * has no accommodations yet.
 */
import { HostTradePublicSchema, PermissionEnum } from '@repo/schemas';
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
 */
export const protectedListHostTradesRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List host-trade entries for the authenticated host',
    description:
        "Returns active host-trade directory entries scoped to the calling host's accommodation destinations. Requires HOST_TRADE_VIEW permission.",
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW],
    responseSchema: z.array(HostTradePublicSchema),
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await hostTradeService.listForHost(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.trades ?? [];
    }
});
