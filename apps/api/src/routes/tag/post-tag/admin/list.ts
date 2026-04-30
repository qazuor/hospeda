/**
 * Admin PostTag list endpoint
 * Returns paginated list of all PostTags (including INACTIVE and ARCHIVED)
 */
import { PermissionEnum, PostTagAdminSearchSchema, PostTagSchema } from '@repo/schemas';
import { PostTagService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/posts/tags
 * List all PostTags — Admin endpoint (includes INACTIVE and ARCHIVED)
 */
export const adminListPostTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all PostTags (admin)',
    description:
        'Returns a paginated list of all PostTags including inactive and archived ones. Supports filtering by lifecycleState, color, and name substring.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_VIEW],
    requestQuery: PostTagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PostTagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await postTagService.listAdmin(actor, query ?? {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
