/**
 * Admin update amenity endpoint
 * Allows admins to update any amenity
 */
import {
    AmenityAdminSchema,
    AmenityIdSchema,
    type AmenityUpdateInput,
    AmenityUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/amenities/:id
 * Update amenity - Admin endpoint
 */
export const adminUpdateAmenityRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update amenity (admin)',
    description: 'Updates any amenity. Admin only.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_UPDATE],
    requestParams: {
        id: AmenityIdSchema
    },
    requestBody: AmenityUpdateInputSchema,
    responseSchema: AmenityAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as AmenityUpdateInput;

        const result = await amenityService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
