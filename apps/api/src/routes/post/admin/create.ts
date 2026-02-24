/**
 * Admin create post endpoint
 * Allows admins to create new posts
 */
import {
    PermissionEnum,
    PostAdminSchema,
    type PostCreateInput,
    PostCreateInputSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/posts
 * Create post - Admin endpoint
 */
export const adminCreatePostRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create post',
    description: 'Creates a new post. Admin only.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_CREATE],
    requestBody: PostCreateInputSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as PostCreateInput;

        const result = await postService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
