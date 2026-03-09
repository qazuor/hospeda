/**
 * Public endpoint for looking up a destination by its materialized path
 * Enables SEO-friendly URL resolution
 */
import { DestinationPublicSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/by-path?path=/argentina/litoral/entre-rios
 * Get destination by materialized path - Public endpoint
 */
export const publicGetDestinationByPathRoute = createPublicRoute({
    method: 'get',
    path: '/by-path',
    summary: 'Get destination by path',
    description:
        'Retrieves a destination by its materialized hierarchy path (e.g., /argentina/litoral/entre-rios)',
    tags: ['Destinations', 'Hierarchy'],
    requestQuery: {
        path: z
            .string()
            .min(1)
            .max(500)
            .regex(/^\/[a-z0-9-/]+$/, {
                message:
                    'Path must start with / and contain only lowercase letters, numbers, hyphens, and slashes'
            })
    },
    responseSchema: DestinationPublicSchema.nullable(),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getByPath(actor, {
            path: (query?.path ?? '') as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
