/**
 * Public destination stats endpoint
 * Returns destination statistics for a specific destination
 */
import { DestinationIdSchema, DestinationStatsSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/stats
 * Get destination stats - Public endpoint
 */
export const publicGetDestinationStatsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/stats',
    summary: 'Get destination stats',
    description: 'Retrieves statistics for a specific destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationStatsSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getStats(actor, {
            destinationId: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 600, // Cache for 10 minutes
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
