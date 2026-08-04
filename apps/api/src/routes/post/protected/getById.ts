/**
 * Protected get-own-post-by-ID endpoint — HOS-374 §5.2.2.
 *
 * Loads one of the caller's own posts for the `/mi-cuenta` editor, in whatever
 * moderation and lifecycle state it is in.
 *
 * This route exists rather than reusing `GET /public/posts/{id}`, which would
 * technically answer: `checkCanViewPost` lets an author read their own pending
 * or private post, so the public route returns it whenever the session cookie
 * rides along. That is a trap. The public route carries `cacheTTL: 300`, so a
 * response shaped by WHO asked would be cached and then served to whoever asks
 * next — an author's unpublished draft handed to an anonymous visitor. A public
 * route must stay actor-blind; anything actor-shaped belongs here.
 *
 * @module routes/post/protected/getById
 */
import { PermissionEnum, PostIdSchema, PostProtectedSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/protected/posts/:id
 *
 * @throws 403 if the actor is neither the author nor a holder of POST_VIEW_ALL.
 * @throws 404 if the post does not exist.
 */
export const protectedGetPostByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own post by ID',
    description:
        'Retrieves a post the actor authored, in any moderation and lifecycle state. ' +
        'Requires authorship or POST_VIEW_ALL.',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostProtectedSchema.nullable(),
    ownership: {
        entityType: 'post',
        ownershipFields: ['authorId'],
        bypassPermission: PermissionEnum.POST_VIEW_ALL
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
