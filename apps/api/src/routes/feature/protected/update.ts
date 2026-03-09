/**
 * Protected update feature endpoint
 * Requires authentication
 */
import {
    FeatureIdSchema,
    FeatureProtectedSchema,
    type FeatureUpdateInput,
    FeatureUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/features/:id
 * Update feature - Protected endpoint
 */
export const protectedUpdateFeatureRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update feature',
    description: 'Updates an existing feature. Requires FEATURE_UPDATE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_UPDATE],
    requestParams: { id: FeatureIdSchema },
    requestBody: FeatureUpdateInputSchema,
    responseSchema: FeatureProtectedSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as FeatureUpdateInput;
        const result = await featureService.update(actor, params.id as string, input);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});
