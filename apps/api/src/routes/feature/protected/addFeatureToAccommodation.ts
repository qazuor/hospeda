/**
 * Protected endpoint to add feature to accommodation
 * Requires authentication
 */
import {
    AccommodationFeatureRelationSchema,
    AccommodationIdSchema,
    type AddFeatureToAccommodationInput,
    AddFeatureToAccommodationInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * POST /api/v1/protected/features/accommodation/:accommodationId
 * Add feature to accommodation - Protected endpoint
 */
export const protectedAddFeatureToAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/accommodation/{accommodationId}',
    summary: 'Add feature to accommodation',
    description:
        'Creates a relation between a feature and an accommodation. Requires ACCOMMODATION_UPDATE permission.',
    tags: ['Features', 'Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
    requestParams: { accommodationId: AccommodationIdSchema },
    requestBody: AddFeatureToAccommodationInputSchema.omit({ accommodationId: true }),
    responseSchema: AccommodationFeatureRelationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = body as Omit<AddFeatureToAccommodationInput, 'accommodationId'>;
        const payload: AddFeatureToAccommodationInput = {
            accommodationId: params.accommodationId as string,
            featureId: parsed.featureId,
            hostReWriteName: parsed.hostReWriteName,
            comments: parsed.comments
        };
        const result = await featureService.addFeatureToAccommodation(actor, payload);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});
