/**
 * Admin list endpoint for partner types (HOS-2336).
 */
import {
    PartnerTypeAdminListItemSchema,
    PartnerTypeAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { PartnerTypeService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * GET /api/v1/admin/partner-types
 * Lists partner types (page + pageSize), each with its partner count (AC-3.1).
 */
export const adminListPartnerTypesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List partner types (admin)',
    description:
        'Returns a paginated list of partner types with a partner count. Filters: search, lifecycleState, includeDeleted.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_VIEW],
    requestQuery: PartnerTypeAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PartnerTypeAdminListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await partnerTypeService.adminList(actor, query || {});
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
