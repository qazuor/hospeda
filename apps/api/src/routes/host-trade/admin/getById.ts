/**
 * Admin get host-trade by ID endpoint
 * Returns full host-trade information including admin fields
 */
import { HostTradeAdminSchema, HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trades/:id
 * Get host-trade entry by ID — Admin endpoint
 */
export const adminGetHostTradeByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get host-trade entry by ID (admin)',
    description: 'Retrieves full host-trade information including all admin fields',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW_ALL],
    requestParams: {
        id: HostTradeIdSchema
    },
    responseSchema: HostTradeAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await hostTradeService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
