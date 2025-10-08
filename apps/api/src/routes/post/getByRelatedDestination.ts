import {
    DestinationIdSchema,
    PostByDestinationHttpSchema,
    PostListItemSchema
} from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postsByDestinationRoute = createListRoute({
    method: 'get',
    path: '/posts/destination/{destinationId}',
    summary: 'Get posts by related destination',
    description: 'Returns posts that are related to a specific destination',
    tags: ['Posts'],
    requestParams: { destinationId: DestinationIdSchema },
    requestQuery: PostByDestinationHttpSchema.shape,
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
