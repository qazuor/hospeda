import { AccommodationIdSchema, AccommodationSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Soft delete accommodation endpoint
 * Requires authentication and proper permissions
 * Marks accommodation as deleted without actually removing it from database
 */
export const softDeleteAccommodationRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Soft delete accommodation',
    description: 'Marks an accommodation as deleted using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        // Get the ID from the path params
        const id = params.id as string;

        // Validate the ID using AccommodationIdSchema
        const validationResult = AccommodationIdSchema.safeParse(id);
        if (!validationResult.success) {
            // Re-throw the Zod error to maintain the expected error format
            throw validationResult.error;
        }

        // Get authenticated actor from context
        const actor = getActorFromContext(ctx);

        // Call the real accommodation service
        const result = await accommodationService.softDelete(actor, id);

        if (result.error) {
            throw new Error(result.error.message);
        }

        // Return the full accommodation object with deletedAt timestamp
        return result.data;
    },
    options: {
        customRateLimit: { requests: 5, windowMs: 60000 } // 5 requests per minute (destructive action)
    }
});
