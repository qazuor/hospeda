/**
 * Protected soft delete event endpoint
 * Requires authentication and ownership
 */
import { EventIdSchema, PermissionEnum } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/events/:id
 * Soft delete event - Protected endpoint with ownership check
 */
export const protectedSoftDeleteEventRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete event',
    description: 'Soft deletes an event. Requires ownership or EVENT_DELETE permission.',
    tags: ['Events'],
    requestParams: {
        id: EventIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    ownership: {
        entityType: 'event',
        ownershipFields: ['createdById'],
        bypassPermission: PermissionEnum.EVENT_DELETE
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await eventService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Event soft deleted successfully'
        };
    }
});
