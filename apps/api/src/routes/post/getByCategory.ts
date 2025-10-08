import { PostCategoryEnumSchema, PostListItemSchema, PostSearchHttpSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostsByCategoryRoute = createListRoute({
    method: 'get',
    path: '/category/{category}',
    summary: 'List posts by category',
    description: 'Returns posts for the given category',
    tags: ['Posts'],
    requestParams: { category: PostCategoryEnumSchema },
    requestQuery: PostSearchHttpSchema.pick({
        page: true,
        pageSize: true,
        sortBy: true,
        sortOrder: true,
        q: true
    }).shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const { category } = params as { category: string };
        const result = await postService.getByCategory(actor, {
            // biome-ignore lint/suspicious/noExplicitAny: enum passthrough
            category: category as any
            // Service schema does not accept pagination; keep filters only
        });
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
