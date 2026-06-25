/**
 * Admin partners list endpoint
 * Returns all partners with full admin access
 */
import { PermissionEnum, adminSearchPartnerSchema, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * GET /api/v1/admin/partners
 * List all partners - Admin endpoint
 * Requires PARTNER_VIEW_ALL permission
 */
export const adminListPartnersRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all partners (admin)',
    description: 'Returns a paginated list of all partners with full admin details',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_VIEW_ALL],
    requestQuery: adminSearchPartnerSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: partnerSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await partnerService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
