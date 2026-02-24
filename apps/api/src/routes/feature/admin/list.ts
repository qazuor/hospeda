/**
 * Admin feature list endpoint
 * Returns all features with full admin access
 */
import {
    FeatureAdminSchema,
    FeatureAdminSearchSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/admin/features
 * List all features - Admin endpoint
 * Admin permissions allow viewing all features via service-level checks
 */
export const adminListFeaturesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all features (admin)',
    description: 'Returns a paginated list of all features with full admin details',
    tags: ['Features'],
    requiredPermissions: [PermissionEnum.FEATURE_VIEW],
    requestQuery: FeatureAdminSearchSchema.shape,
    responseSchema: FeatureAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await featureService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
