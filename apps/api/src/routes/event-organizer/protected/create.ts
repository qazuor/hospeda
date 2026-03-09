/**
 * Protected create event organizer endpoint
 * Requires authentication
 */
import {
    type EventOrganizerCreateHttp,
    EventOrganizerCreateHttpSchema,
    EventOrganizerProtectedSchema,
    PermissionEnum,
    httpToDomainEventOrganizerCreate
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * POST /api/v1/protected/event-organizers
 * Create event organizer - Protected endpoint
 */
export const protectedCreateEventOrganizerRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create event organizer',
    description: 'Creates a new event organizer. Requires EVENT_ORGANIZER_CREATE permission.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_CREATE],
    requestBody: EventOrganizerCreateHttpSchema,
    responseSchema: EventOrganizerProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainEventOrganizerCreate(body as EventOrganizerCreateHttp);
        const result = await eventOrganizerService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
