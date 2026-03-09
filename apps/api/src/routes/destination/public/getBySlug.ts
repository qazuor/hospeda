/**
 * Public destination by slug endpoint
 * Returns destination details by slug
 */
import { DestinationPublicSchema } from '@repo/schemas';
import { SlugRequestParamsSchema } from '@repo/schemas/common';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/slug/:slug
 * Get destination by slug - Public endpoint
 */
export const publicGetDestinationBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get destination by slug',
    description: 'Retrieves a destination by its slug',
    tags: ['Destinations'],
    requestParams: SlugRequestParamsSchema.shape,
    responseSchema: DestinationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;
        const result = await destinationService.getBySlug(actor, slug);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
