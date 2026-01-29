/**
 * Protected update amenity endpoint
 * Requires authentication and AMENITY_UPDATE permission
 */
import {
    AmenityIdSchema,
    AmenityProtectedSchema,
    AmenityUpdateHttpSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/amenities/:id
 * Update amenity - Protected endpoint
 */
export const protectedUpdateAmenityRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update amenity',
    description: 'Updates an existing amenity. Requires AMENITY_UPDATE permission.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_UPDATE],
    requestParams: {
        id: AmenityIdSchema
    },
    requestBody: AmenityUpdateHttpSchema,
    responseSchema: AmenityProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
