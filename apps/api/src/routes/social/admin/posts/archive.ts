/**
 * Admin archive social post endpoint.
 * Archives (soft-deletes) a post, excluding it from default list queries.
 */
import { IdSchema, PermissionEnum, SocialPostStatusResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/archive
 * Archive (soft-delete) a social post — Admin endpoint.
 */
export const adminArchiveSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/archive',
    summary: 'Archive social post (admin)',
    description: 'Archives a social post by setting status=ARCHIVED and soft-deleting the row.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_ARCHIVE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostStatusResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.archive({ actor, postId });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return result.data;
    }
});
