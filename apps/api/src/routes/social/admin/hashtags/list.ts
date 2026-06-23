/**
 * Admin list social hashtags endpoint.
 * Returns all hashtags (including deleted) with full admin access.
 */
import { PermissionEnum, SocialHashtagAdminSearchSchema, SocialHashtagSchema } from '@repo/schemas';
import { ServiceError, SocialHashtagService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const hashtagService = new SocialHashtagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/hashtags
 * List all social hashtags — Admin endpoint (includes deleted).
 */
export const adminListSocialHashtagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social hashtags (admin)',
    description: 'Returns a paginated list of all social hashtags including deleted ones',
    tags: ['Social Hashtags'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_VIEW],
    requestQuery: SocialHashtagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialHashtagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await hashtagService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
