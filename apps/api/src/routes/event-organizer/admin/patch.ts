/**
 * Admin patch event organizer endpoint
 * Allows admins to partially update any event organizer
 */
import {
    EventOrganizerAdminSchema,
    EventOrganizerIdSchema,
    EventOrganizerPatchInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/event-organizers/:id
 * Partial update event organizer - Admin endpoint
 */
export const adminPatchEventOrganizerRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update event organizer (admin)',
    description: 'Updates specific fields of any event organizer. Admin only.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_UPDATE],
    requestParams: { id: EventOrganizerIdSchema },
    requestBody: EventOrganizerPatchInputSchema,
    responseSchema: EventOrganizerAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);
        const result = await eventOrganizerService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
