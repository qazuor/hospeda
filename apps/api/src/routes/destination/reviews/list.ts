import {
    DestinationIdSchema,
    DestinationReviewSchema,
    DestinationReviewsByDestinationHttpSchema
} from '@repo/schemas';
import { DestinationReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createListRoute } from '../../../utils/route-factory';

// Instantiate inside handler to play well with test mocks

export const listDestinationReviewsRoute = createListRoute({
    method: 'get',
    path: '/{destinationId}/reviews',
    summary: 'List destination reviews',
    description: 'Returns a paginated list of reviews for a specific destination',
    tags: ['Destinations', 'Reviews'],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestQuery: DestinationReviewsByDestinationHttpSchema.shape,
    responseSchema: DestinationReviewSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        // Reuse generic list from BaseCrudService with a where filter if needed; for now, simple list
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data.items,
            pagination: getPaginationResponse(result.data.total, { page, pageSize })
        };
    }
});
