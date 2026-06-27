import {
    FeatureFlagAdminSchema,
    FeatureFlagIdSchema,
    type FeatureFlagUpdateHttp,
    FeatureFlagUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminUpdateFeatureFlagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update a feature flag (admin)',
    description: 'Updates a feature flag. Only provided fields are changed.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestParams: { id: FeatureFlagIdSchema },
    requestBody: FeatureFlagUpdateHttpSchema,
    responseSchema: FeatureFlagAdminSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        return featureFlagService.updateFlag(
            actor,
            params.id as string,
            body as FeatureFlagUpdateHttp
        );
    }
});
