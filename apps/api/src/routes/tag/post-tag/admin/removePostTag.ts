/**
 * Admin remove single PostTag from a post endpoint
 * Removes a single PostTag assignment from a specific post
 */
import { PermissionEnum } from '@repo/schemas';
import { PostTagService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/** Path parameter schemas */
const PostTagAssignParamsSchema = {
    postId: z
        .string({ message: 'zodError.common.id.required' })
        .uuid({ message: 'zodError.common.id.invalidUuid' }),
    tagId: z
        .string({ message: 'zodError.common.id.required' })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
};

/** Response schema for remove confirmation */
const RemovePostTagResponseSchema = z.object({
    success: z.boolean()
});

/**
 * DELETE /api/v1/admin/posts/:postId/tags/:tagId
 * Remove a PostTag from a post — Admin endpoint
 *
 * Idempotent: if the assignment does not exist, returns success silently.
 */
export const adminRemovePostTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{postId}/tags/{tagId}',
    summary: 'Remove PostTag from a post',
    description:
        'Removes a single PostTag assignment from a post. Idempotent — succeeds even if the assignment does not exist. Requires POST_TAG_ASSIGN permission.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_ASSIGN],
    requestParams: PostTagAssignParamsSchema,
    responseSchema: RemovePostTagResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.postId as string;
        const tagId = params.tagId as string;

        const result = await postTagService.removeTagFromPost(actor, postId, tagId);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
