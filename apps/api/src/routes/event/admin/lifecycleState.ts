/**
 * Admin lifecycle-state event endpoint — HOS-374 §7.6.4.
 *
 * Moves an event through its lifecycle (DRAFT / ACTIVE / ARCHIVED) by writing
 * `lifecycleState` and nothing else.
 *
 * @module routes/event/admin/lifecycleState
 */
import {
    ContentLifecycleStateInputSchema,
    EventAdminSchema,
    EventIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/admin/events/:id/lifecycle-state
 *
 * @throws 400 if `lifecycleState` is not a valid lifecycle status.
 * @throws 403 if the actor lacks `EVENT_LIFECYCLE_CHANGE`.
 * @throws 404 if the event does not exist.
 */
export const adminSetEventLifecycleStateRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/lifecycle-state',
    summary: 'Set event lifecycle state (admin)',
    description:
        'Sets the event lifecycle state (DRAFT | ACTIVE | ARCHIVED). Requires ' +
        'EVENT_LIFECYCLE_CHANGE.',
    tags: ['Events', 'Admin'],
    requiredPermissions: [PermissionEnum.EVENT_LIFECYCLE_CHANGE],
    requestParams: { id: EventIdSchema },
    requestBody: ContentLifecycleStateInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { lifecycleState } = ContentLifecycleStateInputSchema.parse(body);

        const result = await eventService.setLifecycleState({
            actor,
            id: params.id as string,
            lifecycleState
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
