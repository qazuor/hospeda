import { z } from '@hono/zod-openapi';
import {
    AccommodationListingPlanSchema,
    AccommodationListingPlanUpdateInputSchema
} from '@repo/schemas';
import { AccommodationListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingPlanUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update accommodation listing plan',
    description: 'Updates an existing accommodation listing plan',
    tags: ['Accommodation Listing Plans'],
    requestParams: { id: z.string().uuid() },
    requestBody: AccommodationListingPlanUpdateInputSchema,
    responseSchema: AccommodationListingPlanSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingPlanService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof AccommodationListingPlanUpdateInputSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
