import {
    AccommodationListingPlanCreateInputSchema,
    AccommodationListingPlanSchema
} from '@repo/schemas';
import { AccommodationListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingPlanCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create accommodation listing plan',
    description: 'Creates a new accommodation listing plan',
    tags: ['Accommodation Listing Plans'],
    requestBody: AccommodationListingPlanCreateInputSchema,
    responseSchema: AccommodationListingPlanSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingPlanService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof AccommodationListingPlanCreateInputSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
