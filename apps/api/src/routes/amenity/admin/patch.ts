/**
 * Admin patch amenity endpoint
 * Allows admins to partially update any amenity
 */
import {
    AmenityAdminSchema,
    AmenityIdSchema,
    AmenityPatchInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/amenities/:id
 * Partial update amenity - Admin endpoint
 */
export const adminPatchAmenityRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update amenity (admin)',
    description: 'Updates specific fields of any amenity. Admin only.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_UPDATE],
    requestParams: {
        id: AmenityIdSchema
    },
    requestBody: AmenityPatchInputSchema,
    responseSchema: AmenityAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await amenityService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
