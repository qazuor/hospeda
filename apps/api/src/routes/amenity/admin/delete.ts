/**
 * Admin soft delete amenity endpoint
 * Soft deletes an amenity
 */
import { AmenityIdSchema, DeleteResultSchema, PermissionEnum } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/amenities/:id
 * Soft delete amenity - Admin endpoint
 */
export const adminDeleteAmenityRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete amenity (admin)',
    description: 'Soft deletes an amenity. Admin only.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_DELETE],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await amenityService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
