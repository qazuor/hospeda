import { PostDetailSchema, PostIdSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get post by ID',
    description: 'Retrieves a post by its ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 300 }
});
