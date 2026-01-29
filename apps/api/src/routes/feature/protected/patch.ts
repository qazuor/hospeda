/**
 * Protected patch feature endpoint
 * Requires authentication
 */
import {
    FeatureIdSchema,
    type FeaturePatchInput,
    FeaturePatchInputSchema,
    FeatureProtectedSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/features/:id
 * Patch feature - Protected endpoint
 */
export const protectedPatchFeatureRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch feature',
    description: 'Partially updates an existing feature. Requires FEATURE_UPDATE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_UPDATE],
    requestParams: { id: FeatureIdSchema },
    requestBody: FeaturePatchInputSchema,
    responseSchema: FeatureProtectedSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as FeaturePatchInput;
        const result = await featureService.update(actor, params.id as string, input);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    }
});
