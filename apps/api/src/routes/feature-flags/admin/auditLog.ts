import {
    FeatureFlagAuditLogResponseSchema,
    FeatureFlagIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { FeatureFlagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory-tiered';

const featureFlagService = new FeatureFlagService();

export const adminGetFeatureFlagAuditLogRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/audit',
    summary: 'Get audit log for a feature flag (admin)',
    description: 'Returns the full audit trail for a feature flag.',
    tags: ['Feature Flags'],
    requiredPermissions: [PermissionEnum.FEATURE_FLAG_MANAGE],
    requestParams: { id: FeatureFlagIdSchema },
    responseSchema: FeatureFlagAuditLogResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        return featureFlagService.getAuditLog(actor, params.id);
    }
});
