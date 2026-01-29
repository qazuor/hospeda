/**
 * Admin restore event location endpoint
 * Restores a soft-deleted event location
 */
import {
    EventLocationAdminSchema,
    EventLocationIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
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
        const result = await eventLocationService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
