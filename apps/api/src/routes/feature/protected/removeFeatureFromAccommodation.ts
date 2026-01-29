/**
 * Protected endpoint to remove feature from accommodation
 * Requires authentication
 */
import {
    AccommodationIdSchema,
    FeatureIdSchema,
    PermissionEnum,
    RemovalResultSchema,
    type RemoveFeatureFromAccommodationInput,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/features/accommodation/:accommodationId/:featureId
 * Remove feature from accommodation - Protected endpoint
 */
export const protectedRemoveFeatureFromAccommodationRoute = createProtectedRoute({
    method: 'delete',
    path: '/accommodation/{accommodationId}/{featureId}',
    summary: 'Remove feature from accommodation',
    description:
        'Removes a relation between a feature and an accommodation. Requires ACCOMMODATION_UPDATE permission.',
    tags: ['Features', 'Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
    requestParams: { accommodationId: AccommodationIdSchema, featureId: FeatureIdSchema },
    responseSchema: RemovalResultSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const payload: RemoveFeatureFromAccommodationInput = {
            accommodationId: params.accommodationId as string,
            featureId: params.featureId as string
        };
        const result = await featureService.removeFeatureFromAccommodation(actor, payload);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    }
});
