import { DestinationIdSchema, DestinationStatsSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const getDestinationStatsRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/stats',
    summary: 'Get destination stats',
    description: 'Returns aggregated stats for a destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationStatsSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.getStats(actor, { destinationId: id });
        if (result.error) throw new Error(result.error.message);
        return result.data?.stats ?? null;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
