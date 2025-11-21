import { z } from '@hono/zod-openapi';
import { AccommodationListingPlanSchema } from '@repo/schemas';
import { AccommodationListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingPlanGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get accommodation listing plan by ID',
    description: 'Returns a single accommodation listing plan by ID',
    tags: ['Accommodation Listing Plans'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AccommodationListingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingPlanService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
