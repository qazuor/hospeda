import { PostIdSchema, PostSummarySchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostSummaryRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get post summary',
    description: 'Retrieve a summary for a specific post',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostSummarySchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.getSummary(actor, { id: id as unknown as never });
        if (result.error) throw new Error(result.error.message);
        return result.data ?? null;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 300 }
});
