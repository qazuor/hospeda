/**
 * Admin hard-delete host-trade endpoint
 * Permanently deletes a host-trade directory entry
 */
import { HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/host-trades/:id/hard
 * Hard-delete host-trade entry — Admin endpoint
 */
export const adminHardDeleteHostTradeRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard-delete host-trade entry',
    description:
        'Permanently deletes a host-trade directory entry. Requires HOST_TRADE_HARD_DELETE permission.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_HARD_DELETE],
    requestParams: {
        id: HostTradeIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await hostTradeService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Host-trade entry permanently deleted'
        };
    }
});
