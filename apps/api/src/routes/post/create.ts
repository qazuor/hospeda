import { PostCreateSchema, PostDetailSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const createPostRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create post',
    description: 'Creates a new post',
    tags: ['Posts'],
    requestBody: PostCreateSchema,
    responseSchema: PostDetailSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.create(actor, body as never);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
