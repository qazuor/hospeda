/**
 * Admin restore feature endpoint
 * Restores a soft-deleted feature
 */
import {
    FeatureAdminSchema,
    FeatureIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * POST /api/v1/admin/features/:id/restore
 * Restore feature - Admin endpoint
 */
export const adminRestoreFeatureRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore feature',
    description: 'Restores a soft-deleted feature. Requires FEATURE_RESTORE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_DELETE],
    requestParams: {
        id: FeatureIdSchema
    },
    responseSchema: FeatureAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
