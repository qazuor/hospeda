/**
 * Public endpoint for getting all descendants of a destination
 * Supports optional depth and type filtering
 */
import {
    DestinationIdSchema,
    DestinationPublicSchema,
    DestinationTypeEnumSchema
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/descendants
 * Get all descendants of a destination - Public endpoint
 */
export const publicGetDestinationDescendantsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/descendants',
    summary: 'Get destination descendants',
    description:
        'Retrieves all descendants of a given destination, with optional depth and type filters',
    tags: ['Destinations', 'Hierarchy'],
    requestParams: {
        id: DestinationIdSchema
    },
    requestQuery: {
        maxDepth: z.coerce.number().int().min(1).max(10).optional(),
        destinationType: DestinationTypeEnumSchema.optional()
    },
    responseSchema: z.object({
        descendants: z.array(DestinationPublicSchema)
    }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getDescendants(actor, {
            destinationId: params.id as string,
            maxDepth: query?.maxDepth as number | undefined,
            destinationType: query?.destinationType as
                | import('@repo/schemas').DestinationTypeEnum
                | undefined
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
