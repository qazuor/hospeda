/**
 * Admin restore event organizer endpoint
 * Restores a soft-deleted event organizer
 */
import { EventOrganizerAdminSchema, EventOrganizerIdSchema, PermissionEnum } from '@repo/schemas';
import { EventOrganizerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventOrganizerService = new EventOrganizerService({ logger: apiLogger });

/**
 * POST /api/v1/admin/event-organizers/:id/restore
 * Restore event organizer - Admin endpoint
 */
export const adminRestoreEventOrganizerRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore event organizer',
    description:
        'Restores a soft-deleted event organizer. Requires EVENT_ORGANIZER_RESTORE permission.',
    tags: ['Event Organizers'],
    requiredPermissions: [PermissionEnum.EVENT_ORGANIZER_RESTORE],
    requestParams: {
        id: EventOrganizerIdSchema
    },
    responseSchema: EventOrganizerAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await eventOrganizerService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await eventOrganizerService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
