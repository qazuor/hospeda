/**
 * Admin hard delete amenity endpoint
 * Permanently deletes an amenity
 */
import { AmenityIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/amenities/:id/hard
 * Hard delete amenity - Admin endpoint
 */
export const adminHardDeleteAmenityRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete amenity',
    description: 'Permanently deletes an amenity. Requires AMENITY_DELETE permission.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_DELETE],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Amenity permanently deleted'
        };
    }
});
