/**
 * Public endpoint for getting direct children of a destination
 * Returns all immediate child destinations
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
 * GET /api/v1/public/destinations/:id/children
 * Get direct children of a destination - Public endpoint
 */
export const publicGetDestinationChildrenRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/children',
    summary: 'Get destination children',
    description: 'Retrieves all direct child destinations of a given destination',
    tags: ['Destinations', 'Hierarchy'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.object({
        children: z.array(DestinationPublicSchema)
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getChildren(actor, {
            destinationId: params.id as string
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
