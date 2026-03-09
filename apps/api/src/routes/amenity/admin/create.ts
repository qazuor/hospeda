/**
 * Admin create amenity endpoint
 * Allows admins to create new amenities
 */
import {
    AmenityAdminSchema,
    type AmenityCreateInput,
    AmenityCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * POST /api/v1/admin/amenities
 * Create amenity - Admin endpoint
 */
export const adminCreateAmenityRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create amenity',
    description: 'Creates a new amenity. Admin only.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_CREATE],
    requestBody: AmenityCreateInputSchema,
    responseSchema: AmenityAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as AmenityCreateInput;

        const result = await amenityService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
