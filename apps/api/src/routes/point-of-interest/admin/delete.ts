/**
 * Admin soft delete point-of-interest endpoint
 * Soft deletes a point of interest
 */
import { DeleteResultSchema, PermissionEnum, PointOfInterestIdSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/points-of-interest/:id
 * Soft delete point of interest - Admin endpoint
 */
export const adminDeletePointOfInterestRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete point of interest (admin)',
    description: 'Soft deletes a point of interest. Admin only.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_DELETE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await pointOfInterestService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
