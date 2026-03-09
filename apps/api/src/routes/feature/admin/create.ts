/**
 * Admin create feature endpoint
 * Allows admins to create new features
 */
import {
    FeatureAdminSchema,
    type FeatureCreateInput,
    FeatureCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * POST /api/v1/admin/features
 * Create feature - Admin endpoint
 */
export const adminCreateFeatureRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create feature',
    description: 'Creates a new feature. Admin only.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_CREATE],
    requestBody: FeatureCreateInputSchema,
    responseSchema: FeatureAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as FeatureCreateInput;

        const result = await featureService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
