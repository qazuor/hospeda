/**
 * Public destination summary endpoint
 * Returns destination summary data
 */
import {
    DestinationIdSchema,
    DestinationSummarySchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/summary
 * Get destination summary - Public endpoint
 */
export const publicGetDestinationSummaryRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get destination summary',
    description: 'Retrieves destination summary with aggregated data',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationSummarySchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getSummary(actor, {
            destinationId: params.id as string
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 600, // Cache for 10 minutes (summary data changes less frequently)
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
