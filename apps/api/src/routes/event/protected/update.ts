/**
 * Protected update event endpoint
 * Requires authentication and ownership
 */
import {
    EventIdSchema,
    EventProtectedSchema,
    type EventUpdateHttp,
    EventUpdateHttpSchema,
    PermissionEnum,
    httpToDomainEventUpdate
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/events/:id
 * Update event - Protected endpoint with ownership check
 */
export const protectedUpdateEventRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event',
    description: 'Updates an existing event. Requires ownership or EVENT_UPDATE_ANY permission.',
    tags: ['Events'],
    requestParams: {
        id: EventIdSchema
    },
    requestBody: EventUpdateHttpSchema,
    responseSchema: EventProtectedSchema,
    ownership: {
        entityType: 'event',
        ownershipFields: ['createdById'],
        bypassPermission: PermissionEnum.EVENT_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Convert HTTP input to domain input
        const domainInput = httpToDomainEventUpdate(body as EventUpdateHttp);
        const result = await eventService.update(actor, id, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
