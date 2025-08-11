import { z } from '@hono/zod-openapi';
import { PostIdSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const likePostRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/like',
    summary: 'Like post',
    description: 'Likes a post by ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: z.object({ success: z.boolean() }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.like(actor, { postId: id });
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
