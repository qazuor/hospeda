/**
 * Admin list social posts endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/posts
 * Returns a paginated list of social posts with optional filters.
 * Delegates to SocialPostService.listPosts.
 */
import {
    PermissionEnum,
    SocialPostAdminSearchSchema,
    SocialPostListItemSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/posts
 * List social posts — Admin endpoint.
 * Supports filtering by status, approvalStatus, platform, search, date range, and includeDeleted.
 */
export const adminListSocialPostsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List social posts (admin)',
    description:
        'Returns a paginated list of social posts. Supports filtering by pipeline status, ' +
        'approval status, platform, text search, date range, and soft-deleted posts. ' +
        'includeDeleted is only honoured for actors with SOCIAL_POST_HARD_DELETE permission.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_VIEW],
    requestQuery: SocialPostAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialPostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const q = query as Record<string, unknown> | undefined;

        const result = await postService.listPosts({
            actor,
            filters: {
                page,
                pageSize,
                status: q?.status as string | undefined,
                approvalStatus: q?.approvalStatus as string | undefined,
                platform: q?.platform as string | undefined,
                search: q?.search as string | undefined,
                createdAtFrom: q?.createdAtFrom as Date | undefined,
                createdAtTo: q?.createdAtTo as Date | undefined,
                includeDeleted: q?.includeDeleted as boolean | undefined
            }
        });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
