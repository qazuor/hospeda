/**
 * Admin set PostTags on a post endpoint
 * Atomically replaces all PostTag assignments for a post (bulk-replace)
 */
import { PermissionEnum } from '@repo/schemas';
import { PostTagService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/** Path parameter schema for post ID */
const PostIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Request body: array of PostTag UUIDs to assign (pass [] to clear all) */
const SetPostTagsBodySchema = z.object({
    postTagIds: z.array(
        z.string({ message: 'zodError.common.id.required' }).uuid({
            message: 'zodError.common.id.invalidUuid'
        })
    )
});

/** Response schema for bulk-replace confirmation */
const SetPostTagsResponseSchema = z.object({
    success: z.boolean()
});

/**
 * POST /api/v1/admin/posts/:postId/tags
 * Set/replace PostTags on a post — Admin endpoint
 *
 * Atomically replaces all PostTag assignments for the given post.
 * Each PostTag in `postTagIds` must exist and be in ACTIVE lifecycle state.
 * Pass an empty array to clear all tags from the post.
 */
export const adminSetPostTagsRoute = createAdminRoute({
    method: 'post',
    path: '/{postId}/tags',
    summary: 'Set PostTags on a post',
    description:
        'Atomically replaces all PostTag assignments for a post. Each PostTag must be ACTIVE. Pass empty postTagIds to clear all tags. Requires POST_TAG_ASSIGN permission.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_ASSIGN],
    requestParams: { postId: PostIdSchema },
    requestBody: SetPostTagsBodySchema,
    responseSchema: SetPostTagsResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.postId as string;
        const { postTagIds } = body as z.infer<typeof SetPostTagsBodySchema>;

        const result = await postTagService.setTagsForPost(actor, postId, postTagIds);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
