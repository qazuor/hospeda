/**
 * Protected create post endpoint
 * Requires authentication
 */
import {
    PermissionEnum,
    type PostCreateHttp,
    PostCreateHttpSchema,
    PostProtectedSchema,
    type ServiceErrorCode,
    httpToDomainPostCreate
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/protected/posts
 * Create post - Protected endpoint
 */
export const protectedCreatePostRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create post',
    description: 'Creates a new post. Requires POST_CREATE permission.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_CREATE],
    requestBody: PostCreateHttpSchema,
    responseSchema: PostProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainPostCreate(body as PostCreateHttp);
        const result = await postService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
