/**
 * Admin soft delete feature endpoint
 * Soft deletes a feature
 */
import {
    DeleteResultSchema,
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
 * DELETE /api/v1/admin/features/:id
 * Soft delete feature - Admin endpoint
 */
export const adminDeleteFeatureRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete feature (admin)',
    description: 'Soft deletes a feature. Admin only.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_DELETE],
    requestParams: {
        id: FeatureIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await featureService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
