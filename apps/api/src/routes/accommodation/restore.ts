/**
 * Restore accommodation endpoint
 * Handles restoration of soft-deleted accommodations using AccommodationService
 */
import { AccommodationDetailSchema, AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Restore soft-deleted accommodation endpoint
 * Requires authentication and proper permissions
 * Restores a previously soft-deleted accommodation
 */
export const restoreAccommodationRoute = createCRUDRoute({
    method: 'post',
    path: '/:id/restore',
    summary: 'Restore accommodation',
    description: 'Restores a soft-deleted accommodation using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
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
        const result = await accommodationService.restore(actor, id);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 } // 10 requests per minute
    }
});
