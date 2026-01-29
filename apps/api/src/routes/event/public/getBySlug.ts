/**
 * Public get event by slug endpoint
 * Returns event details by slug
 */
import { EventPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { SlugRequestParamsSchema } from '@repo/schemas/common';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/public/events/slug/:slug
 * Get event by slug - Public endpoint
 */
export const publicGetEventBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get event by slug',
    description: 'Retrieves an event by its slug',
    tags: ['Events'],
    requestParams: SlugRequestParamsSchema.shape,
    responseSchema: EventPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;
        const result = await eventService.getBySlug(actor, slug);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
