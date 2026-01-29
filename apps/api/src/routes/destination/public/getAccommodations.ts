/**
 * Public destination accommodations endpoint
 * Returns accommodations for a specific destination
 */
import {
    AccommodationPublicSchema,
    DestinationIdSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/accommodations
 * Get destination accommodations - Public endpoint
 */
export const publicGetDestinationAccommodationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'Get destination accommodations',
    description: 'Retrieves all accommodations for a specific destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.array(AccommodationPublicSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getAccommodations(actor, {
            destinationId: params.id as string,
            page: 1,
            pageSize: 100
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data || [];
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
