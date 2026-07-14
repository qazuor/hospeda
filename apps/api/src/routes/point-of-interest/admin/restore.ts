/**
 * Admin restore point-of-interest endpoint
 * Restores a soft-deleted point of interest
 */
import { PermissionEnum, PointOfInterestAdminSchema, PointOfInterestIdSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * POST /api/v1/admin/points-of-interest/:id/restore
 * Restore point of interest - Admin endpoint
 */
export const adminRestorePointOfInterestRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore point of interest',
    description:
        'Restores a soft-deleted point of interest. Requires POINT_OF_INTEREST_RESTORE permission.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_RESTORE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: PointOfInterestAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await pointOfInterestService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await pointOfInterestService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
