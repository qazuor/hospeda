import {
    FeatureFlagAdminSchema,
    type FeatureFlagAdminSearch,
    FeatureFlagAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminListRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminListFeatureFlagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all feature flags (admin)',
    description: 'Returns a paginated list of all feature flags with admin details.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestQuery: FeatureFlagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: FeatureFlagAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        return featureFlagService.adminList(actor, query as FeatureFlagAdminSearch);
    }
});
