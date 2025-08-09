/**
 * Update accommodation endpoint
 * Handles updating existing accommodations using AccommodationService
 */
import { z } from '@hono/zod-openapi';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { accommodationSchema, accommodationUpdateSchema } from './schemas';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Update existing accommodation endpoint
 * Requires authentication and proper permissions
 */
export const updateAccommodationRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update accommodation',
    description: 'Updates an existing accommodation using the AccommodationService',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().min(1, 'Accommodation ID is required')
    },
    requestBody: accommodationUpdateSchema,
    responseSchema: accommodationSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // Get authenticated actor from context
        const actor = getActorFromContext(ctx);

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof accommodationUpdateSchema>;

        // Call the real accommodation service
        const result = await accommodationService.update(actor, params.id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 } // 20 requests per minute
    }
});
