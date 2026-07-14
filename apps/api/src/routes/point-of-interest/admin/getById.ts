/**
 * Admin get point-of-interest by ID endpoint
 * Returns full point-of-interest information including admin fields
 */
import { PermissionEnum, PointOfInterestAdminSchema, PointOfInterestIdSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/admin/points-of-interest/:id
 * Get point of interest by ID - Admin endpoint
 */
export const adminGetPointOfInterestByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get point of interest by ID (admin)',
    description: 'Retrieves full point-of-interest information including admin fields',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_VIEW],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: PointOfInterestAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await pointOfInterestService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60000 } }
});
