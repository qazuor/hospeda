import { z } from '@hono/zod-openapi';
import { AdSlotReservationSchema } from '@repo/schemas';
import { AdSlotReservationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adSlotReservationDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete ad slot reservation',
    description: 'Soft deletes an ad slot reservation',
    tags: ['Ad Slot Reservations'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AdSlotReservationSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new AdSlotReservationService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
