/**
 * Public get experience listing by slug endpoint (T-019)
 * Returns a single experience listing projected through ExperiencePublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { ExperiencePublicSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences/slug/:slug
 * Get experience listing by slug — Public endpoint.
 *
 * Delegates to ExperienceService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetExperienceBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get experience listing by slug',
    description: 'Retrieves an experience listing by its URL-friendly slug',
    tags: ['Experience'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: ExperiencePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.getBySlug(actor, params.slug as string);

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
