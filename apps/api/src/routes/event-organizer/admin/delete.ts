/**
 * Admin soft delete event organizer endpoint
 * Allows admins to soft delete any event organizer
 */
import {
    DeleteResultSchema,
    EventOrganizerIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/event-organizers/:id
 * Soft delete event organizer - Admin endpoint
 */
export const adminDeleteEventOrganizerRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event organizer (admin)',
    description: 'Soft deletes an event organizer. Admin only.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_DELETE],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await eventOrganizerService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
