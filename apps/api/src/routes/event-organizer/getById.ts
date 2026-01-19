import { z } from '@hono/zod-openapi';
import { EventOrganizerSchema } from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const eventOrganizerGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get event organizer by ID',
    description: 'Returns a single event organizer by ID',
    tags: ['Event Organizers'],
    requestParams: { id: z.string().uuid() },
    responseSchema: EventOrganizerSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new EventOrganizerService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw result.error;
        return result.data;
    }
});
