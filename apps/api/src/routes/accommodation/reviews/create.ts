import { z } from '@hono/zod-openapi';
import {
    AccommodationIdSchema,
    AccommodationReviewCreateInputSchema,
    AccommodationReviewSchema
} from '@repo/schemas';
import { AccommodationReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Lazy-load service to play well with test mocks

export const createAccommodationReviewRoute = createCRUDRoute({
    method: 'post',
    path: '/{accommodationId}/reviews',
    summary: 'Create accommodation review',
    description: 'Creates a new review for a specific accommodation',
    tags: ['Accommodations', 'Reviews'],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestBody: z.object(AccommodationReviewCreateInputSchema.shape),
    responseSchema: z.object(AccommodationReviewSchema.shape),
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof AccommodationReviewCreateInputSchema>;
        // Ensure path param and body accommodationId are consistent; prefer validated path param
        const payload = {
            ...input,
            accommodationId: params.accommodationId as z.infer<typeof AccommodationIdSchema>
        };
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
