/**
 * Admin update point-of-interest endpoint
 * Allows admins to update any point of interest
 */
import {
    PermissionEnum,
    PointOfInterestAdminSchema,
    PointOfInterestIdSchema,
    type PointOfInterestUpdateInput,
    PointOfInterestUpdateInputSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/points-of-interest/:id
 * Update point of interest - Admin endpoint
 */
export const adminUpdatePointOfInterestRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update point of interest (admin)',
    description: 'Updates any point of interest. Admin only.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    requestBody: PointOfInterestUpdateInputSchema,
    responseSchema: PointOfInterestAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as PointOfInterestUpdateInput;

        const result = await pointOfInterestService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
