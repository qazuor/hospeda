import {
    FeatureFlagDeleteResponseSchema,
    FeatureFlagIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminDeleteFeatureFlagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a feature flag (admin)',
    description: 'Permanently deletes a feature flag.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestParams: { id: FeatureFlagIdSchema },
    responseSchema: FeatureFlagDeleteResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        await featureFlagService.deleteFlag(actor, params.id);
        return { success: true };
    }
});
