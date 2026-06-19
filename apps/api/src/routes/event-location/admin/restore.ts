/**
 * Admin restore event location endpoint
 * Restores a soft-deleted event location
 */
import { EventLocationAdminSchema, EventLocationIdSchema, PermissionEnum } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/event-locations/:id/restore
 * Restore event location - Admin endpoint
 */
export const adminRestoreEventLocationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore event location',
    description:
        'Restores a soft-deleted event location. Requires EVENT_LOCATION_RESTORE permission.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_RESTORE],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: EventLocationAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await eventLocationService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await eventLocationService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
