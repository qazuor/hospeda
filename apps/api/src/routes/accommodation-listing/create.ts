import {
    AccommodationListingCreateHttpInputSchema,
    AccommodationListingSchema
} from '@repo/schemas';
import { AccommodationListingService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create accommodation listing',
    description: 'Creates a new accommodation listing',
    tags: ['Accommodation Listings'],
    requestBody: AccommodationListingCreateHttpInputSchema,
    responseSchema: AccommodationListingSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof AccommodationListingCreateHttpInputSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
