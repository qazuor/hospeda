/**
 * Protected patch event location endpoint
 * Requires authentication and ownership
 */
import {
    EventLocationIdSchema,
    EventLocationProtectedSchema,
    EventLocationUpdateHttpSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/event-locations/:id
 * Partial update event location - Protected endpoint with ownership check
 */
export const protectedPatchEventLocationRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch event location',
    description:
        'Partially updates an event location. Requires ownership or EVENT_LOCATION_UPDATE permission.',
    tags: ['Event Locations'],
    requestParams: {
        id: EventLocationIdSchema
    },
    requestBody: EventLocationUpdateHttpSchema.partial(),
    responseSchema: EventLocationProtectedSchema,
    ownership: {
        entityType: 'eventLocation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.EVENT_LOCATION_UPDATE
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Use update method for patch - service handles partial updates
        const result = await eventLocationService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
