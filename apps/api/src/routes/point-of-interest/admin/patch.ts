/**
 * Admin patch point-of-interest endpoint
 * Allows admins to partially update any point of interest
 * Note: PointOfInterest does not have a dedicated PatchInputSchema.
 * PointOfInterestUpdateInputSchema is already partial and is used for both PUT and PATCH.
 */
import {
    PermissionEnum,
    PointOfInterestAdminSchema,
    PointOfInterestIdSchema,
    PointOfInterestUpdateInputSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/points-of-interest/:id
 * Partial update point of interest - Admin endpoint
 */
export const adminPatchPointOfInterestRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update point of interest (admin)',
    description: 'Updates specific fields of any point of interest. Admin only.',
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
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await pointOfInterestService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
