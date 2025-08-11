import { PostIdSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const hardDeletePostRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete post',
    description: 'Hard deletes a post by ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.hardDelete(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
