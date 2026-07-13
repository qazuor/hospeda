/**
 * Public get point-of-interest by slug endpoint
 * Returns a single point of interest by its slug
 */
import { PointOfInterestPublicSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/public/points-of-interest/slug/:slug
 * Get point of interest by slug - Public endpoint
 *
 * The slug regex allows underscores (unlike `attraction`'s hyphen-only
 * pattern) — POIs carry no `name` column (HOS-113 OQ-2; display names come
 * from `nameI18n` since HOS-138) and the slug mirrors the amenity/feature
 * underscore convention (SPEC-266), matching
 * `PointOfInterestSchema.shape.slug` exactly.
 */
export const publicGetPointOfInterestBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get point of interest by slug',
    description: 'Retrieves a point of interest by its slug',
    tags: ['PointsOfInterest'],
    requestParams: {
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
    },
    responseSchema: PointOfInterestPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await pointOfInterestService.getBySlug(actor, params.slug as string);

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
