/**
 * Admin update host-trade endpoint
 * Allows admins to fully update any host-trade directory entry
 */
import {
    HostTradeAdminSchema,
    HostTradeIdSchema,
    type HostTradeUpdateHttp,
    HostTradeUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/host-trades/:id
 * Update host-trade entry — Admin endpoint
 */
export const adminUpdateHostTradeRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update host-trade entry (admin)',
    description: 'Fully updates any host-trade directory entry. Admin only.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_UPDATE],
    requestParams: {
        id: HostTradeIdSchema
    },
    requestBody: HostTradeUpdateHttpSchema,
    responseSchema: HostTradeAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as HostTradeUpdateHttp;

        const result = await hostTradeService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
