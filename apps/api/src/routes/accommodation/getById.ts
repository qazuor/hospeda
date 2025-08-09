import { AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { accommodationSchema } from './schemas';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Get accommodation by ID endpoint
 * Public endpoint that doesn't require authentication
 */
export const accommodationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID',
    description: 'Retrieves an accommodation by its ID using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: accommodationSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        // Call the real accommodation service
        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // Skip header validation for public endpoint
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});
