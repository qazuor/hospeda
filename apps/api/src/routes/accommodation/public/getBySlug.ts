/**
 * Public get accommodation by slug endpoint
 * Returns a single accommodation by its slug
 */
import { AccommodationPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/public/accommodations/slug/:slug
 * Get accommodation by slug - Public endpoint
 */
export const publicGetAccommodationBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get accommodation by slug',
    description: 'Retrieves an accommodation by its URL-friendly slug',
    tags: ['Accommodations'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: AccommodationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getBySlug(actor, params.slug as string);

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
