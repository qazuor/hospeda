import { z } from '@hono/zod-openapi';
import { AdSlotReservationSchema, UpdateAdSlotReservationSchema } from '@repo/schemas';
import { AdSlotReservationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adSlotReservationUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update ad slot reservation',
    description: 'Updates an existing ad slot reservation',
    tags: ['Ad Slot Reservations'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateAdSlotReservationSchema,
    responseSchema: AdSlotReservationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdSlotReservationService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateAdSlotReservationSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
