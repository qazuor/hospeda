/**
 * Public get event location by slug endpoint
 * Returns a single event location by its slug
 */
import { EventLocationPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-locations/slug/:slug
 * Get event location by slug - Public endpoint
 */
export const publicGetEventLocationBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get event location by slug',
    description: 'Retrieves an event location by its URL-friendly slug',
    tags: ['Event Locations'],
    requestParams: {
        slug: z.string().min(1).max(100)
    },
    responseSchema: EventLocationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.getBySlug(actor, params.slug as string);

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
