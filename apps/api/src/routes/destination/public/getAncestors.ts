/**
 * Public endpoint for getting all ancestors of a destination
 * Returns the ancestor chain from root to parent
 */
import { DestinationIdSchema, DestinationPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/ancestors
 * Get all ancestors of a destination - Public endpoint
 */
export const publicGetDestinationAncestorsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/ancestors',
    summary: 'Get destination ancestors',
    description:
        'Retrieves all ancestor destinations from root to the parent of the given destination',
    tags: ['Destinations', 'Hierarchy'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.object({
        ancestors: z.array(DestinationPublicSchema)
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getAncestors(actor, {
            destinationId: params.id as string
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 600, // Cache ancestors longer (they change rarely)
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
