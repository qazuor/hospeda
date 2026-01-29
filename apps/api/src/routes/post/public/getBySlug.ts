/**
 * Public get post by slug endpoint
 * Returns a single post by its slug
 */
import { PostPublicSchema, PostSlugSchema, type ServiceErrorCode } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/slug/:slug
 * Get post by slug - Public endpoint
 */
export const publicGetPostBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get post by slug',
    description: 'Retrieves a post by its slug',
    tags: ['Posts'],
    requestParams: { slug: PostSlugSchema },
    responseSchema: PostPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getBySlug(actor, params.slug as string);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
