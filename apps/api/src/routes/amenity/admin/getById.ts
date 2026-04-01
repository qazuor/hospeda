/**
 * Admin get amenity by ID endpoint
 * Returns full amenity information including admin fields
 */
import { AmenityAdminSchema, AmenityIdSchema, PermissionEnum } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * GET /api/v1/admin/amenities/:id
 * Get amenity by ID - Admin endpoint
 */
export const adminGetAmenityByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get amenity by ID (admin)',
    description: 'Retrieves full amenity information including admin fields',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_UPDATE],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: AmenityAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 } }
});
