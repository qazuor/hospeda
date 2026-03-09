/**
 * Admin hard delete event organizer endpoint
 * Permanently deletes an event organizer
 */
import { EventOrganizerIdSchema, PermissionEnum } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/event-organizers/:id/hard
 * Hard delete event organizer - Admin endpoint
 */
export const adminHardDeleteEventOrganizerRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete event organizer',
    description:
        'Permanently deletes an event organizer. Requires EVENT_ORGANIZER_HARD_DELETE permission.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_HARD_DELETE],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventOrganizerService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Event organizer permanently deleted'
        };
    }
});
