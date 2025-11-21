import { z } from '@hono/zod-openapi';
import { AccommodationListingPlanSchema } from '@repo/schemas';
import { AccommodationListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingPlanDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete accommodation listing plan',
    description: 'Soft deletes an accommodation listing plan',
    tags: ['Accommodation Listing Plans'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AccommodationListingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingPlanService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
