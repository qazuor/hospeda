/**
 * Protected create event endpoint
 * Requires authentication
 */
import {
    type EventCreateHttp,
    EventCreateHttpSchema,
    EventProtectedSchema,
    PermissionEnum,
    httpToDomainEventCreate
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/protected/events
 * Create event - Protected endpoint
 */
export const protectedCreateEventRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create event',
    description: 'Creates a new event. Requires EVENT_CREATE permission.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_CREATE],
    requestBody: EventCreateHttpSchema,
    responseSchema: EventProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainEventCreate(body as EventCreateHttp);
        const result = await eventService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
