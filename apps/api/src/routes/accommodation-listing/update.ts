import { z } from '@hono/zod-openapi';
import {
    AccommodationListingSchema,
    AccommodationListingUpdateHttpInputSchema
} from '@repo/schemas';
import { AccommodationListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update accommodation listing',
    description: 'Updates an existing accommodation listing',
    tags: ['Accommodation Listings'],
    requestParams: { id: z.string().uuid() },
    requestBody: AccommodationListingUpdateHttpInputSchema,
    responseSchema: AccommodationListingSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof AccommodationListingUpdateHttpInputSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
