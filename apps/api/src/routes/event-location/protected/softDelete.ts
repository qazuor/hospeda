/**
 * Protected soft delete event location endpoint
 * Requires authentication and ownership
 */
import { EventLocationIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/event-locations/:id
 * Soft delete event location - Protected endpoint with ownership check
 */
export const protectedSoftDeleteEventLocationRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event location',
    description:
        'Soft deletes an event location. Requires ownership or EVENT_LOCATION_DELETE permission.',
    tags: ['Event Locations'],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    ownership: {
        entityType: 'eventLocation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.EVENT_LOCATION_DELETE
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventLocationService.softDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Event location soft deleted successfully'
        };
    }
});
