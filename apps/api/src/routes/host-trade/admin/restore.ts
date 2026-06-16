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
        const result = await hostTradeService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
