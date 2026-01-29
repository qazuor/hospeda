/**
 * Public get event location by ID endpoint
 * Returns a single event location by its ID
 */
import {
    EventLocationIdSchema,
    EventLocationPublicSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/public/event-locations/:id
 * Get event location by ID - Public endpoint
 */
export const publicGetEventLocationByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get event location by ID',
    description: 'Retrieves an event location by its ID',
    tags: ['Event Locations'],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: EventLocationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.getById(actor, params.id as string);

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
