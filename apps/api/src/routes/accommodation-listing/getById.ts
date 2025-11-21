import { z } from '@hono/zod-openapi';
import { AccommodationListingSchema } from '@repo/schemas';
import { AccommodationListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const accommodationListingGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get accommodation listing by ID',
    description: 'Returns a single accommodation listing by ID',
    tags: ['Accommodation Listings'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AccommodationListingSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AccommodationListingService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
