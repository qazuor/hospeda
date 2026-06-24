import {
    FeatureFlagAdminSchema,
    FeatureFlagIdSchema,
    type FeatureFlagToggleHttp,
    FeatureFlagToggleHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminToggleFeatureFlagRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/toggle',
    summary: 'Toggle feature flag kill-switch (admin)',
    description:
        'Activates or deactivates a feature flag. When deactivated, the flag is force-disabled.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestParams: { id: FeatureFlagIdSchema },
    requestBody: FeatureFlagToggleHttpSchema,
    responseSchema: FeatureFlagAdminSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const payload = body as FeatureFlagToggleHttp;
        return featureFlagService.toggleFlag(
            actor,
            params.id as string,
            payload.isActive,
            payload.reason
        );
    }
});
