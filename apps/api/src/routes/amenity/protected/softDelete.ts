/**
 * Protected soft delete amenity endpoint
 * Requires authentication and AMENITY_DELETE permission
 */
import { AmenityIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { successResponseSchema } from '../../../schemas/response-schemas.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/amenities/:id
 * Soft delete amenity - Protected endpoint
 */
export const protectedSoftDeleteAmenityRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete amenity',
    description: 'Marks an amenity as deleted (soft delete). Requires AMENITY_DELETE permission.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_DELETE],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: successResponseSchema(z.object({ success: z.boolean() })),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.softDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return { success: true };
    }
});
