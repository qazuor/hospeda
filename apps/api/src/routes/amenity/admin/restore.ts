/**
 * Admin restore amenity endpoint
 * Restores a soft-deleted amenity
 */
import { AmenityAdminSchema, AmenityIdSchema, PermissionEnum } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * POST /api/v1/admin/amenities/:id/restore
 * Restore amenity - Admin endpoint
 */
export const adminRestoreAmenityRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore amenity',
    description: 'Restores a soft-deleted amenity',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_DELETE],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: AmenityAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await amenityService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await amenityService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
