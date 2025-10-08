import type { z } from '@hono/zod-openapi';
import {
    DestinationIdSchema,
    DestinationReviewCreateInputSchema,
    DestinationReviewSchema
} from '@repo/schemas';
import { DestinationReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Lazy instantiate in handler

export const createDestinationReviewRoute = createCRUDRoute({
    method: 'post',
    path: '/{destinationId}/reviews',
    summary: 'Create destination review',
    description: 'Creates a new review for a specific destination',
    tags: ['Destinations', 'Reviews'],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestBody: DestinationReviewCreateInputSchema,
    responseSchema: DestinationReviewSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof DestinationReviewCreateInputSchema>;
        const payload = {
            ...input,
            destinationId: params.destinationId as z.infer<typeof DestinationIdSchema>
        };
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
