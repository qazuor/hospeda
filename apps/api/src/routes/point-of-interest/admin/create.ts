/**
 * Admin create point-of-interest endpoint
 * Allows admins to create new points of interest
 */
import {
    PermissionEnum,
    PointOfInterestAdminSchema,
    type PointOfInterestCreateInput,
    PointOfInterestCreateInputSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * POST /api/v1/admin/points-of-interest
 * Create point of interest - Admin endpoint
 */
export const adminCreatePointOfInterestRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create point of interest',
    description: 'Creates a new point of interest. Admin only.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_CREATE],
    requestBody: PointOfInterestCreateInputSchema,
    responseSchema: PointOfInterestAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as PointOfInterestCreateInput;

        const result = await pointOfInterestService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
