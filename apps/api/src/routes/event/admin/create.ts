/**
 * Admin create event endpoint
 * Allows admins to create new events
 */
import {
    adminBodyToDomainEventCreate,
    type EventAdminCreateBody,
    EventAdminCreateBodySchema,
    EventAdminSchema,
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
    requestBody: EventAdminCreateBodySchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Authorship comes from the actor, never from the body (HOS-374 D-2),
        // exactly as the protected sibling resolves it. Declaring the domain
        // schema here instead demanded an `authorId` the panel has no field
        // for, which made the admin alta impossible (HOS-998).
        const data = adminBodyToDomainEventCreate(body as EventAdminCreateBody, actor.id);

        const result = await eventService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
