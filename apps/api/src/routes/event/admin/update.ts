/**
 * Admin update event endpoint
 * Allows admins to update any event
 */
import {
    EventAdminSchema,
    EventIdSchema,
    type EventUpdateInput,
    EventUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/events/:id
 * Update event - Admin endpoint
 */
export const adminUpdateEventRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update event (admin)',
    description: 'Updates any event. Admin only.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: {
        id: EventIdSchema
    },
    requestBody: EventUpdateInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as EventUpdateInput;

        const result = await eventService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
