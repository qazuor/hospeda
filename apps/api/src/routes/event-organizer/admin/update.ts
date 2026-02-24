/**
 * Admin update event organizer endpoint
 * Allows admins to update any event organizer
 */
import {
    EventOrganizerAdminSchema,
    EventOrganizerIdSchema,
    type EventOrganizerUpdateInput,
    EventOrganizerUpdateInputSchema,
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
 * PUT /api/v1/admin/event-organizers/:id
 * Update event organizer - Admin endpoint
 */
export const adminUpdateEventOrganizerRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event organizer (admin)',
    description: 'Updates any event organizer. Admin only.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_UPDATE],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    requestBody: EventOrganizerUpdateInputSchema,
    responseSchema: EventOrganizerAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as EventOrganizerUpdateInput;
        const result = await eventOrganizerService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
