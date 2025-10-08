import { EventIdSchema, PostByEventHttpSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postsByEventRoute = createListRoute({
    method: 'get',
    path: '/posts/event/{eventId}',
    summary: 'Get posts by related event',
    description: 'Returns posts that are related to a specific event',
    tags: ['Posts'],
    requestParams: { eventId: EventIdSchema },
    requestQuery: PostByEventHttpSchema.shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const { eventId } = params as { eventId: string };
        const result = await postService.getByRelatedEvent(actor, {
            eventId: eventId as unknown as never
            // No pagination in service schema for this method
        });
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
