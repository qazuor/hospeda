/**
 * Public destination summary endpoint
 * Returns destination summary data
 */
import { DestinationIdSchema, DestinationSummaryPublicSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../../utils/actor';
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
    responseSchema: DestinationSummaryPublicSchema.nullable(),
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const actor = createGuestActor();
        const result = await destinationService.getSummary(actor, {
            destinationId: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        // Service wraps the value as { summary }; the responseSchema is the
        // inner DestinationSummarySchema, so unwrap before returning.
        return result.data?.summary ?? null;
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
