/**
 * Protected create event location endpoint
 * Requires authentication
 */
import {
    type EventLocationCreateHttp,
    EventLocationCreateHttpSchema,
    EventLocationProtectedSchema,
    PermissionEnum,
    httpToDomainEventLocationCreate
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/event-locations
 * Create event location - Protected endpoint
 */
export const protectedCreateEventLocationRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create event location',
    description: 'Creates a new event location. Requires EVENT_LOCATION_CREATE permission.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_CREATE],
    requestBody: EventLocationCreateHttpSchema,
    responseSchema: EventLocationProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainEventLocationCreate(body as EventLocationCreateHttp);
        const result = await eventLocationService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
