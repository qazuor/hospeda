import { PostIdSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const restorePostRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore post',
    description: 'Restores a soft-deleted post',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.restore(actor, id);
        if (result.error) throw new Error(result.error.message);
        return { id };
    }
});
