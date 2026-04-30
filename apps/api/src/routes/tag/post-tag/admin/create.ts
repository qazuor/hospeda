/**
 * Admin PostTag create endpoint
 * Creates a new PostTag (admin/editor only)
 */
import {
    type CreatePostTagInput,
    CreatePostTagSchema,
    PermissionEnum,
    PostTagSchema
} from '@repo/schemas';
import { PostTagService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/**
 * POST /api/v1/admin/posts/tags
 * Create PostTag — Admin endpoint
 */
export const adminCreatePostTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create PostTag',
    description:
        'Creates a new PostTag. Requires POST_TAG_CREATE permission. Slug and name must be unique.',
    tags: ['PostTags'],
    requiredPermissions: [PermissionEnum.POST_TAG_CREATE],
    requestBody: CreatePostTagSchema,
    responseSchema: PostTagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as CreatePostTagInput;

        const result = await postTagService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
