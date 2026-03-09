/**
 * Admin soft delete event location endpoint
 * Allows admins to soft delete any event location
 */
import { DeleteResultSchema, EventLocationIdSchema, PermissionEnum } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/event-locations/:id
 * Soft delete event location - Admin endpoint
 */
export const adminDeleteEventLocationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event location (admin)',
    description: 'Soft deletes an event location. Admin only.',
    tags: ['Event Locations'],
    requiredPermissions: [PermissionEnum.EVENT_LOCATION_DELETE],
    requestParams: {
        id: EventLocationIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await eventLocationService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
