import { PostDetailSchema, PostIdSchema, PostUpdateSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const updatePostRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update post',
    description: 'Updates an existing post',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    requestBody: PostUpdateSchema,
    responseSchema: PostDetailSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.update(actor, id, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
