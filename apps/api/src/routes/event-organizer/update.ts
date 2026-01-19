import { z } from '@hono/zod-openapi';
import {
    EventOrganizerSchema,
    EventOrganizerUpdateHttpSchema,
    httpToDomainEventOrganizerUpdate
} from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const eventOrganizerUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update event organizer',
    description: 'Updates an existing event organizer',
    tags: ['Event Organizers'],
    requestParams: { id: z.string().uuid() },
    requestBody: EventOrganizerUpdateHttpSchema,
    responseSchema: EventOrganizerSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new EventOrganizerService({ logger: apiLogger });

        // Convert HTTP input to domain format
        const httpData = body as z.infer<typeof EventOrganizerUpdateHttpSchema>;
        const domainData = httpToDomainEventOrganizerUpdate(httpData);

        const result = await service.update(actor, params.id as string, domainData);
        if (result.error) throw result.error;
        return result.data;
    }
});
