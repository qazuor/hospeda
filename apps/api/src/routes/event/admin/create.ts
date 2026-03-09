/**
 * Admin create event endpoint
 * Allows admins to create new events
 */
import {
    EventAdminSchema,
    type EventCreateInput,
    EventCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/admin/events
 * Create event - Admin endpoint
 */
export const adminCreateEventRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create event',
    description: 'Creates a new event. Admin only.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_CREATE],
    requestBody: EventCreateInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as EventCreateInput;

        const result = await eventService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
