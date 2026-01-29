/**
 * Protected soft delete event organizer endpoint
 * Requires authentication and ownership
 */
import { EventOrganizerIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/event-organizers/:id
 * Soft delete event organizer - Protected endpoint with ownership check
 */
export const protectedSoftDeleteEventOrganizerRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event organizer',
    description:
        'Soft deletes an event organizer. Requires ownership or EVENT_ORGANIZER_DELETE permission.',
    tags: ['Event Organizers'],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    ownership: {
        entityType: 'eventOrganizer',
        ownershipFields: ['createdById'],
        bypassPermission: PermissionEnum.EVENT_ORGANIZER_DELETE
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.softDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Event organizer soft deleted successfully'
        };
    }
});
