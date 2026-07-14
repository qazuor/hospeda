/**
 * Admin hard delete point-of-interest endpoint
 * Permanently deletes a point of interest
 */
import { PermissionEnum, PointOfInterestIdSchema } from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/points-of-interest/:id/hard
 * Hard delete point of interest - Admin endpoint
 */
export const adminHardDeletePointOfInterestRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete point of interest',
    description:
        'Permanently deletes a point of interest. Requires POINT_OF_INTEREST_HARD_DELETE permission.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_HARD_DELETE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await pointOfInterestService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Point of interest permanently deleted'
        };
    }
});
