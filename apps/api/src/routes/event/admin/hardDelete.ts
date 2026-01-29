/**
 * Admin hard delete event endpoint
 * Permanently deletes an event
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
 * DELETE /api/v1/admin/events/:id/hard
 * Hard delete event - Admin endpoint
 */
export const adminHardDeleteEventRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete event',
    description: 'Permanently deletes an event. Requires EVENT_HARD_DELETE permission.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_HARD_DELETE],
    requestParams: {
        id: EventIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Event permanently deleted'
        };
    }
});
