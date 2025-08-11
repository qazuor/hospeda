import { z } from '@hono/zod-openapi';
import { AccommodationIdSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getPostsByRelatedAccommodationRoute = createListRoute({
    method: 'get',
    path: '/accommodation/{accommodationId}',
    summary: 'List posts by related accommodation',
    description: 'Returns posts related to an accommodation',
    tags: ['Posts'],
    requestParams: { accommodationId: AccommodationIdSchema },
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: PostListItemSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const { accommodationId } = params as { accommodationId: string };
        const result = await postService.getByRelatedAccommodation(actor, {
            accommodationId: accommodationId as unknown as never
            // No pagination in service schema for this method
        });
        if (result.error) throw new Error(result.error.message);
        return result.data as never;
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
