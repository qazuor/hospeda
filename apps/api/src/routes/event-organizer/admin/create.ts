/**
 * Admin create event organizer endpoint
 * Allows admins to create new event organizers
 */
import {
    EventOrganizerAdminSchema,
    type EventOrganizerCreateInput,
    EventOrganizerCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * POST /api/v1/admin/event-organizers
 * Create event organizer - Admin endpoint
 */
export const adminCreateEventOrganizerRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create event organizer',
    description: 'Creates a new event organizer. Admin only.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_CREATE],
    requestBody: EventOrganizerCreateInputSchema,
    responseSchema: EventOrganizerAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as EventOrganizerCreateInput;
        const result = await eventOrganizerService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
