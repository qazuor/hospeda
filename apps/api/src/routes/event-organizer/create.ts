import {
    EventOrganizerCreateHttpSchema,
    EventOrganizerSchema,
    httpToDomainEventOrganizerCreate
} from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const eventOrganizerCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create event organizer',
    description: 'Creates a new event organizer',
    tags: ['Event Organizers'],
    requestBody: EventOrganizerCreateHttpSchema,
    responseSchema: EventOrganizerSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new EventOrganizerService({ logger: apiLogger });

        // Convert HTTP input to domain format
        const httpData = body as z.infer<typeof EventOrganizerCreateHttpSchema>;
        const domainData = httpToDomainEventOrganizerCreate(httpData);

        const result = await service.create(actor, domainData);
        if (result.error) throw result.error;
        return result.data;
    }
});
