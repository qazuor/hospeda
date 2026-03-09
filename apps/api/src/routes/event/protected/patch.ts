/**
 * Protected patch event endpoint
 * Requires authentication and ownership
 */
import {
    EventIdSchema,
    EventProtectedSchema,
    EventUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/events/:id
 * Partial update event - Protected endpoint with ownership check
 */
export const protectedPatchEventRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch event',
    description: 'Partially updates an event. Requires ownership or EVENT_UPDATE_ANY permission.',
    tags: ['Events'],
    requestParams: {
        id: EventIdSchema
    },
    requestBody: EventUpdateHttpSchema.partial(),
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
        // Use update method for patch - service handles partial updates
        const result = await eventService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
