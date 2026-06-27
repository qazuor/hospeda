import { FeatureFlagAdminSchema, FeatureFlagIdSchema, PermissionEnum } from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminGetFeatureFlagByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get feature flag by ID (admin)',
    description: 'Returns a single feature flag with full details.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestParams: { id: FeatureFlagIdSchema },
    responseSchema: FeatureFlagAdminSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        return featureFlagService.getById(actor, params.id as string);
    }
});
