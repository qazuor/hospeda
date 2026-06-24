import { FeatureFlagAdminSchema, FeatureFlagCreateHttpSchema, PermissionEnum } from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminCreateFeatureFlagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new feature flag (admin)',
    description: 'Creates a new feature flag. Key must be unique.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestBody: FeatureFlagCreateHttpSchema,
    responseSchema: FeatureFlagAdminSchema,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        return featureFlagService.createFlag(actor, body);
    }
});
