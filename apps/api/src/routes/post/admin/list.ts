/**
 * Admin post list endpoint
 * Returns all posts including deleted ones
 */
import { PermissionEnum, PostAdminSchema, PostAdminSearchSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/posts
 * List all posts - Admin endpoint (includes deleted)
 */
export const adminListPostsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all posts',
    description: 'Returns a paginated list of all posts including deleted ones',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    requestQuery: PostAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PostAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Admin can see all posts
        const result = await postService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
