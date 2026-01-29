/**
 * Public get attraction by slug endpoint
 * Returns a single attraction by its slug
 */
import { AttractionPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/public/attractions/slug/:slug
 * Get attraction by slug - Public endpoint
 */
export const publicGetAttractionBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get attraction by slug',
    description: 'Retrieves an attraction by its slug',
    tags: ['Attractions'],
    requestParams: {
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    },
    responseSchema: AttractionPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.getBySlug(actor, params.slug as string);

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
