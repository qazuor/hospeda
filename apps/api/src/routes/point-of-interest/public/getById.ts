/**
 * Public get point-of-interest by ID endpoint
 * Returns a single point of interest by its ID
 */
import { PointOfInterestIdSchema, PointOfInterestPublicSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/public/points-of-interest/:id
 * Get point of interest by ID - Public endpoint
 */
export const publicGetPointOfInterestByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get point of interest by ID',
    description: 'Retrieves a point of interest by its ID',
    tags: ['PointsOfInterest'],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: PointOfInterestPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await pointOfInterestService.getById(actor, params.id as string);

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
