import { z } from '@hono/zod-openapi';
/**
 * Patch accommodation endpoint
 * Handles partial updates to existing accommodations using AccommodationService
 */
import { AccommodationSchema, AccommodationUpdateInputSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Partially update existing accommodation endpoint
 * Requires authentication and proper permissions
 * Semantically correct for partial updates (only modified fields)
 */
export const patchAccommodationRoute = createCRUDRoute({
    method: 'patch',
    path: '/:id',
    summary: 'Partially update accommodation',
    description:
        'Partially updates an existing accommodation with only the provided fields using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().min(1, 'Accommodation ID is required')
    },
    requestBody: AccommodationUpdateInputSchema, // Already .partial() so perfect for PATCH
    responseSchema: AccommodationSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // Get authenticated actor from context
        const actor = getActorFromContext(ctx);

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof AccommodationUpdateInputSchema>;

        // Call the accommodation service (same method as PUT - it already handles partial updates)
        const result = await accommodationService.update(actor, params.id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 } // 20 requests per minute (same as PUT)
    }
});
