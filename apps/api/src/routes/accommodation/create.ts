import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { accommodationCreateSchema, accommodationSchema } from './schemas';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Create new accommodation endpoint
 * Requires authentication and proper permissions
 */
export const createAccommodationRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create accommodation',
    description: 'Creates a new accommodation using the AccommodationService',
    tags: ['Accommodations'],
    requestBody: accommodationCreateSchema,
    responseSchema: accommodationSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // Get authenticated actor from context
        const actor = getActorFromContext(ctx);

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof accommodationCreateSchema>;

        // Call the real accommodation service
        const result = await accommodationService.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 } // 10 requests per minute
    }
});
