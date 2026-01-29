/**
 * Public get event organizer by slug endpoint
 * Returns a single event organizer by its slug
 */
import { EventOrganizerPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-organizers/slug/:slug
 * Get event organizer by slug - Public endpoint
 */
export const publicGetEventOrganizerBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get event organizer by slug',
    description: 'Retrieves an event organizer by its URL-friendly slug',
    tags: ['Event Organizers'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: EventOrganizerPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
