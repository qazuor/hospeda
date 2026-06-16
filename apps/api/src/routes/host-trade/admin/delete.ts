/**
 * Admin soft-delete host-trade endpoint
 * Soft-deletes a host-trade directory entry
 */
import { DeleteResultSchema, HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/host-trades/:id
 * Soft-delete host-trade entry — Admin endpoint
 */
export const adminDeleteHostTradeRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete host-trade entry (admin)',
    description: 'Soft-deletes a host-trade directory entry. Admin only.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_DELETE],
    requestParams: {
        id: HostTradeIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await hostTradeService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
