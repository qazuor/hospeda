import {
    DestinationIdSchema,
    DestinationSchema,
    DestinationUpdateInputSchema
} from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PATCH endpoint for partial updates to destinations
 * Follows the same pattern as PUT but semantically correct for partial updates
 */
export const patchDestinationRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update destination',
    description: 'Partially updates a destination by ID with only the provided fields',
    tags: ['Destinations'],
    requestParams: { id: DestinationIdSchema },
    requestBody: DestinationUpdateInputSchema, // Already .partial() so perfect for PATCH
    responseSchema: DestinationSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Use the same service method as PUT - it already handles partial updates
        const result = await destinationService.update(actor, id, body as never);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
