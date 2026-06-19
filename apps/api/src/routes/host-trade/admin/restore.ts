/**
 * Admin restore host-trade endpoint
 * Restores a soft-deleted host-trade directory entry
 */
import { HostTradeAdminSchema, HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * POST /api/v1/admin/host-trades/:id/restore
 * Restore host-trade entry — Admin endpoint
 */
export const adminRestoreHostTradeRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore host-trade entry',
    description:
        'Restores a soft-deleted host-trade directory entry. Requires HOST_TRADE_RESTORE permission.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_RESTORE],
    requestParams: {
        id: HostTradeIdSchema
    },
    responseSchema: HostTradeAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await hostTradeService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await hostTradeService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
