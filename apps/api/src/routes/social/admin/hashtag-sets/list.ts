/**
 * Admin list social hashtag sets endpoint.
 */
import {
    PermissionEnum,
    SocialHashtagSetAdminSearchSchema,
    SocialHashtagSetSchema
} from '@repo/schemas';
import { ServiceError, SocialHashtagSetService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const hashtagSetService = new SocialHashtagSetService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/hashtag-sets
 * List all social hashtag sets — Admin endpoint (includes deleted).
 */
export const adminListSocialHashtagSetsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social hashtag sets (admin)',
    description: 'Returns a paginated list of all social hashtag sets including deleted ones',
    tags: ['Social Hashtag Sets'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE],
    requestQuery: SocialHashtagSetAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialHashtagSetSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await hashtagSetService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
