import { AdSlotListParamsSchema, AdSlotSchema } from '@repo/schemas';
import { AdSlotService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const adSlotListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List ad slots',
    description: 'Returns a paginated list of advertising slots with filtering options',
    tags: ['Ad Slots'],
    requestQuery: AdSlotListParamsSchema.shape,
    responseSchema: AdSlotSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const service = new AdSlotService({ logger: apiLogger });
        const result = await service.list(actor, query || {});

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
