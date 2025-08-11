import { z } from '@hono/zod-openapi';
import { PostDetailSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostBySlugRoute = createCRUDRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get post by slug',
    description: 'Retrieves a post by its slug',
    tags: ['Posts'],
    requestParams: { slug: z.string().min(1) },
    responseSchema: PostDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;
        const result = await postService.getBySlug(actor, slug);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 300 }
});
