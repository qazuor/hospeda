import { EventIdSchema, EventSummarySchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

const handler = async (ctx: Context, params: Record<string, unknown>) => {
    const id = params.id as string;
    const validation = EventIdSchema.safeParse(id);
    if (!validation.success) throw validation.error;
    const actor = getActorFromContext(ctx);
    const result = await eventService.getSummary(actor, { eventId: id });
    if (result.error) throw new Error(result.error.message);
    return result.data ?? null;
};

export const getEventSummaryRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get event summary',
    description: 'Retrieve a summary for a specific event',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventSummarySchema.nullable(),
    handler,
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
