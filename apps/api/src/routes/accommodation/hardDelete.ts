/**
 * Hard delete accommodation endpoint
 * Handles permanent deletion of accommodations using AccommodationService
 */
import { z } from '@hono/zod-openapi';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Hard delete accommodation endpoint
 * Requires authentication and admin permissions
 * Permanently removes accommodation from database - DESTRUCTIVE ACTION
 */
export const hardDeleteAccommodationRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id/hard',
    summary: 'Hard delete accommodation',
    description:
        'Permanently removes an accommodation from the database using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().min(1, 'Accommodation ID is required')
    },
    responseSchema: z.object({
        count: z.number(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        // Get authenticated actor from context
        const actor = getActorFromContext(ctx);

        // Call the real accommodation service
        const result = await accommodationService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            count: result.data?.count || 0,
            message: 'Accommodation permanently deleted from database'
        };
    },
    options: {
        customRateLimit: { requests: 2, windowMs: 60000 } // 2 requests per minute (highly destructive action)
    }
});
