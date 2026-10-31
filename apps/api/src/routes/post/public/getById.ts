/**
 * Public get post by ID endpoint
 * Returns a single post by its ID
 */
import { PostIdSchema, PostPublicSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/:id
 * Get post by ID - Public endpoint
 */
export const publicGetPostByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get post by ID',
    description: 'Retrieves a post by its ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostPublicSchema.nullable(),
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        // HOS-1924: this path is shared-cached under a key with no actor in it, so the
        // service must never see the request's real actor.
        const actor = createGuestActor();
        const result = await postService.getById(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {}
});
