/**
 * Public endpoint for getting breadcrumb navigation data
 * Returns breadcrumb items from root to the given destination
 */
import { BreadcrumbResponseSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/breadcrumb
 * Get breadcrumb navigation data - Public endpoint
 */
export const publicGetDestinationBreadcrumbRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/breadcrumb',
    summary: 'Get destination breadcrumb',
    description:
        'Retrieves breadcrumb navigation data from root to the given destination, including the destination itself',
    tags: ['Destinations', 'Hierarchy'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.object({
        breadcrumb: BreadcrumbResponseSchema
    }),
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const actor = createGuestActor();
        const result = await destinationService.getBreadcrumb(actor, {
            destinationId: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 } // Higher limit for navigation
    }
});
