import {
    AccommodationIdSchema,
    PostByAccommodationHttpSchema,
    PostListItemSchema
} from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postsByAccommodationRoute = createListRoute({
    method: 'get',
    path: '/posts/accommodation/{accommodationId}',
    summary: 'Get posts by related accommodation',
    description: 'Returns posts that are related to a specific accommodation',
    tags: ['Posts'],
    requestParams: { accommodationId: AccommodationIdSchema },
    requestQuery: PostByAccommodationHttpSchema.shape,
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
