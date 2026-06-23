/**
 * Admin list social post footers endpoint.
 */
import {
    PermissionEnum,
    SocialPostFooterAdminSearchSchema,
    SocialPostFooterSchema
} from '@repo/schemas';
import { ServiceError, SocialPostFooterService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const footerService = new SocialPostFooterService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/footers
 * List all social post footers — Admin endpoint (includes deleted).
 */
export const adminListSocialFootersRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social post footers (admin)',
    description: 'Returns a paginated list of all social post footers including deleted ones',
    tags: ['Social Footers'],
    requiredPermissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE],
    requestQuery: SocialPostFooterAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialPostFooterSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await footerService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
