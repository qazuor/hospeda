/**
 * Admin restore amenity endpoint
 * Restores a soft-deleted amenity
 */
import { AmenityAdminSchema, AmenityIdSchema, type ServiceErrorCode } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

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
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: AmenityAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
