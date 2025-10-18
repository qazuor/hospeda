/**
 * Get accommodation by slug endpoint
 * Handles retrieving accommodation by slug using AccommodationService
 */
import { AccommodationSchema } from '@repo/schemas';
import { AccommodationSlugRequestParamsSchema } from '@repo/schemas/common';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Get accommodation by slug endpoint
 * Public endpoint that doesn't require authentication
 */
export const getAccommodationBySlugRoute = createCRUDRoute({
    method: 'get',
    path: '/slug/:slug',
    summary: 'Get accommodation by slug',
    description: 'Retrieves an accommodation by its slug using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: AccommodationSlugRequestParamsSchema.shape,
    responseSchema: AccommodationSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        // Get actor from context (can be guest)
        const actor = getActorFromContext(ctx);

        // Call the real accommodation service
        const result = await accommodationService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        skipAuth: true, // Public endpoint
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
    }
});
