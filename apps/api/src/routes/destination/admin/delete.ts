/**
 * Admin delete (soft) destination endpoint
 * Allows admins to soft delete any destination
 */
import {
    DeleteResultSchema,
    DestinationIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/destinations/:id
 * Soft delete destination - Admin endpoint
 */
export const adminDeleteDestinationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete destination (admin)',
    description: 'Soft deletes a destination. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_DELETE],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await destinationService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
