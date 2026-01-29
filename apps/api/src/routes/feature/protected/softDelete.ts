/**
 * Protected soft delete feature endpoint
 * Requires authentication
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
import { createProtectedRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/features/:id
 * Soft delete feature - Protected endpoint
 */
export const protectedSoftDeleteFeatureRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete feature',
    description: 'Marks a feature as deleted. Requires FEATURE_SOFT_DELETE permission.',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_DELETE],
    requestParams: { id: FeatureIdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.softDelete(actor, params.id as string);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    }
});
