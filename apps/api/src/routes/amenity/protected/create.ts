/**
 * Protected create amenity endpoint
 * Requires authentication and AMENITY_CREATE permission
 */
import {
    type AmenityCreateHttp,
    AmenityCreateHttpSchema,
    AmenityProtectedSchema,
    PermissionEnum,
    type ServiceErrorCode,
    httpToDomainAmenityCreate
} from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * POST /api/v1/protected/amenities
 * Create amenity - Protected endpoint
 */
export const protectedCreateAmenityRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create amenity',
    description: 'Creates a new amenity. Requires AMENITY_CREATE permission.',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_CREATE],
    requestBody: AmenityCreateHttpSchema,
    responseSchema: AmenityProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainAmenityCreate(body as AmenityCreateHttp);
        const result = await amenityService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
