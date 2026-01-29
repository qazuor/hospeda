/**
 * Admin restore event endpoint
 * Restores a soft-deleted event
 */
import { EventIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/admin/events/:id/restore
 * Restore event - Admin endpoint
 */
export const adminRestoreEventRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore event',
    description: 'Restores a soft-deleted event. Requires EVENT_RESTORE permission.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_RESTORE],
    requestParams: {
        id: EventIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Event restored successfully'
        };
    }
});
