import { AdSlotReservationSchema, SearchAdSlotReservationSchema } from '@repo/schemas';
import { AdSlotReservationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const adSlotReservationListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List ad slot reservations',
    description: 'Returns a paginated list of ad slot reservations',
    tags: ['Ad Slot Reservations'],
    requestQuery: SearchAdSlotReservationSchema.shape,
    responseSchema: AdSlotReservationSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new AdSlotReservationService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
