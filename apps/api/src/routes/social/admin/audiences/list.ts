/**
 * Admin list social audiences endpoint.
 */
import {
    PermissionEnum,
    SocialAudienceAdminSearchSchema,
    SocialAudienceSchema
} from '@repo/schemas';
import { ServiceError, SocialAudienceService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const audienceService = new SocialAudienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/audiences
 * List all social audiences — Admin endpoint (includes deleted).
 */
export const adminListSocialAudiencesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social audiences (admin)',
    description: 'Returns a paginated list of all social audiences including deleted ones',
    tags: ['Social Audiences'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE],
    requestQuery: SocialAudienceAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialAudienceSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await audienceService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
