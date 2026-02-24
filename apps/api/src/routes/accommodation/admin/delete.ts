/**
 * Admin delete (soft) accommodation endpoint
 * Allows admins to soft delete any accommodation
 */
import {
    AccommodationIdSchema,
    DeleteResultSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodations/:id
 * Soft delete accommodation - Admin endpoint
 */
export const adminDeleteAccommodationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete accommodation (admin)',
    description: 'Soft deletes an accommodation. Admin only.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await accommodationService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
