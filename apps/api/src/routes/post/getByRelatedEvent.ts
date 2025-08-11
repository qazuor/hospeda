import { z } from '@hono/zod-openapi';
import { EventIdSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostsByRelatedEventRoute = createListRoute({
    method: 'get',
    path: '/event/{eventId}',
    summary: 'List posts by related event',
    description: 'Returns posts related to an event',
    tags: ['Posts'],
    requestParams: { eventId: EventIdSchema },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
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
