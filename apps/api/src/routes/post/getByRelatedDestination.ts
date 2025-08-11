import { z } from '@hono/zod-openapi';
import { DestinationIdSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostsByRelatedDestinationRoute = createListRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'List posts by related destination',
    description: 'Returns posts related to a destination',
    tags: ['Posts'],
    requestParams: { destinationId: DestinationIdSchema },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: PostListItemSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const { destinationId } = params as { destinationId: string };
        const result = await postService.getByRelatedDestination(actor, {
            destinationId: destinationId as unknown as never
            // No pagination in service schema for this method
        });
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
