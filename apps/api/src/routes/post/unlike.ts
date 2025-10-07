import { PostIdSchema, SuccessSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const unlikePostRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/unlike',
    summary: 'Unlike post',
    description: 'Unlikes a post by ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.unlike(actor, { postId: id });
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
