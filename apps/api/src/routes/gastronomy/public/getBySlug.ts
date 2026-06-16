/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { GastronomyPublicSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/slug/:slug
 * Get gastronomy listing by slug — Public endpoint.
 *
 * Delegates to GastronomyService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetGastronomyBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get gastronomy listing by slug',
    description: 'Retrieves a gastronomy listing by its URL-friendly slug',
    tags: ['Gastronomy'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: GastronomyPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
