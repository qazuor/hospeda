/**
 * Protected update event organizer endpoint
 * Requires authentication and ownership
 */
import {
    EventOrganizerIdSchema,
    EventOrganizerProtectedSchema,
    EventOrganizerUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/event-organizers/:id
 * Update event organizer - Protected endpoint with ownership check
 */
export const protectedUpdateEventOrganizerRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event organizer',
    description:
        'Updates an existing event organizer. Requires ownership or EVENT_ORGANIZER_UPDATE permission.',
    tags: ['Event Organizers'],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    requestBody: EventOrganizerUpdateHttpSchema,
    responseSchema: EventOrganizerProtectedSchema,
    ownership: {
        entityType: 'eventOrganizer',
        ownershipFields: ['createdById'],
        bypassPermission: PermissionEnum.EVENT_ORGANIZER_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
