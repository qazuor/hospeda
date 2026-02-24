/**
 * Admin owner promotion list endpoint
 * Returns all owner promotions with full admin access
 */
import {
    OwnerPromotionAdminSearchSchema,
    OwnerPromotionSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/admin/owner-promotions
 * List all owner promotions - Admin endpoint
 * Admin permissions allow viewing all owner promotions via service-level checks
 */
export const adminListOwnerPromotionsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all owner promotions (admin)',
    description: 'Returns a paginated list of all owner promotions with full admin details',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_VIEW],
    requestQuery: OwnerPromotionAdminSearchSchema.shape,
    responseSchema: OwnerPromotionSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await ownerPromotionService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
