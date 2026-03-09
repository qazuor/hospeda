/**
 * Admin update feature endpoint
 * Allows admins to update any feature
 */
import {
    FeatureAdminSchema,
    FeatureIdSchema,
    type FeatureUpdateInput,
    FeatureUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/features/:id
 * Update feature - Admin endpoint
 */
export const adminUpdateFeatureRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update feature (admin)',
    description: 'Updates any feature. Admin only.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_UPDATE],
    requestParams: {
        id: FeatureIdSchema
    },
    requestBody: FeatureUpdateInputSchema,
    responseSchema: FeatureAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as FeatureUpdateInput;

        const result = await featureService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
