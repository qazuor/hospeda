/**
 * Public get posts by category endpoint
 * Returns posts filtered by category
 */
import {
    type PostCategoryEnum,
    PostCategoryEnumSchema,
    PostListItemSchema,
    PostsByCategoryHttpSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/category/:category
 * Get posts by category - Public endpoint
 */
export const publicGetPostsByCategoryRoute = createPublicListRoute({
    method: 'get',
    path: '/category/{category}',
    summary: 'Get posts by category',
    description: 'Returns posts filtered by category',
    tags: ['Posts'],
    requestParams: { category: PostCategoryEnumSchema },
    requestQuery: PostsByCategoryHttpSchema.shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await postService.getByCategory(actor, {
            category: params.category as PostCategoryEnum
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300
    }
});
