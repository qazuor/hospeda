import { z } from '@hono/zod-openapi';
import { EventDetailSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Public route: Get event by slug
 *
 * Returns a nullable event detail for the provided slug. This endpoint is public
 * (no authentication required) and cached briefly. It uses the service layer
 * `getBySlug` method, which enforces visibility rules.
 *
 * - Path params: `slug` (string, required)
 * - Response: `EventDetailSchema | null`
 */
export const getEventBySlugRoute = createCRUDRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get event by slug',
    description: 'Retrieves an event by its slug',
    tags: ['Events'],
    requestParams: {
        slug: z.string().min(1)
    },
    responseSchema: EventDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;
        const result = await eventService.getBySlug(actor, slug);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
