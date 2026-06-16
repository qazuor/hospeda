/**
 * Admin create host-trade endpoint
 * Allows admins to create new host-trade directory entries
 */
import {
    HostTradeAdminSchema,
    type HostTradeCreateHttp,
    HostTradeCreateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * POST /api/v1/admin/host-trades
 * Create host-trade entry — Admin endpoint
 */
export const adminCreateHostTradeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create host-trade entry',
    description: 'Creates a new host-trade directory entry. Admin only.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CREATE],
    requestBody: HostTradeCreateHttpSchema,
    responseSchema: HostTradeAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as HostTradeCreateHttp;

        const result = await hostTradeService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
