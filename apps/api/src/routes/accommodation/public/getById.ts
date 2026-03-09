/**
 * Public get accommodation by ID endpoint
 * Returns a single accommodation by its ID
 */
import { AccommodationIdSchema, AccommodationPublicSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/public/accommodations/:id
 * Get accommodation by ID - Public endpoint
 */
export const publicGetAccommodationByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID',
    description: 'Retrieves an accommodation by its ID',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
