/**
 * Public get event organizer by ID endpoint
 * Returns a single event organizer by its ID
 */
import { EventOrganizerIdSchema, EventOrganizerPublicSchema } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-organizers/:id
 * Get event organizer by ID - Public endpoint
 */
export const publicGetEventOrganizerByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event organizer by ID',
    description: 'Retrieves an event organizer by its ID',
    tags: ['Event Organizers'],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: EventOrganizerPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
