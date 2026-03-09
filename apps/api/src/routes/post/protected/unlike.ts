/**
 * Protected unlike post endpoint
 * Requires authentication
 */
import { PostIdSchema, SuccessSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/posts/:id/like
 * Unlike post - Protected endpoint
 */
export const protectedUnlikePostRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/like',
    summary: 'Unlike post',
    description: 'Unlikes a post. Requires authentication.',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.unlike(actor, { postId: id });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
