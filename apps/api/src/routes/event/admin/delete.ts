/**
 * Admin delete (soft) event endpoint
 * Allows admins to soft delete any event
 */
import {
    DeleteResultSchema,
    EventIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/events/:id
 * Soft delete event - Admin endpoint
 */
export const adminDeleteEventRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event (admin)',
    description: 'Soft deletes an event. Admin only.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_DELETE],
    requestParams: {
        id: EventIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await eventService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
