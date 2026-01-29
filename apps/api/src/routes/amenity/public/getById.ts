/**
 * Public amenity detail endpoint
 * Returns a single amenity by ID
 */
import { AmenityIdSchema, AmenityPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * GET /api/v1/public/amenities/:id
 * Get amenity by ID - Public endpoint
 */
export const publicGetAmenityByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get amenity by ID',
    description: 'Retrieves an amenity by its ID',
    tags: ['Amenities'],
    requestParams: {
        id: AmenityIdSchema
    },
    responseSchema: AmenityPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await amenityService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
