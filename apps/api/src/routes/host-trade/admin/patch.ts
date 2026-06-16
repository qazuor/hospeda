/**
 * Admin patch host-trade endpoint
 * Allows admins to partially update any host-trade directory entry
 */
import {
    HostTradeAdminSchema,
    HostTradeIdSchema,
    HostTradeUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/host-trades/:id
 * Partial update host-trade entry — Admin endpoint
 */
export const adminPatchHostTradeRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update host-trade entry (admin)',
    description: 'Updates specific fields of any host-trade directory entry. Admin only.',
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
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await hostTradeService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
