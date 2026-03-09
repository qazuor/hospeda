/**
 * Protected update post endpoint
 * Requires authentication and ownership
 */
import {
    PermissionEnum,
    PostIdSchema,
    PostProtectedSchema,
    type PostUpdateHttp,
    PostUpdateHttpSchema,
    httpToDomainPostUpdate
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/posts/:id
 * Update post - Protected endpoint
 */
export const protectedUpdatePostRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update post',
    description: 'Updates an existing post. Requires POST_UPDATE permission.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_UPDATE],
    requestParams: { id: PostIdSchema },
    requestBody: PostUpdateHttpSchema,
    responseSchema: PostProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        // Convert HTTP input to domain input
        const domainInput = httpToDomainPostUpdate(body as PostUpdateHttp);
        const result = await postService.update(actor, id, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
