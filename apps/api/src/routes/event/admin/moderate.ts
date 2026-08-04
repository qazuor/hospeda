/**
 * Admin moderate event endpoint — HOS-374 §7.6.4.
 *
 * Applies the platform's moderation verdict to one event. Delegates to
 * `EventService.moderate()`, which gates the action on
 * {@link PermissionEnum.EVENT_MODERATION_CHANGE} and writes `moderationState`
 * and nothing else.
 *
 * Until this route existed the verdict was set through the generic update,
 * behind plain `EVENT_UPDATE` — which is what made every publication gate in the
 * model bypassable.
 *
 * @module routes/event/admin/moderate
 */
import {
    ContentModerationChangeInputSchema,
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
 * POST /api/v1/admin/events/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor lacks `EVENT_MODERATION_CHANGE`.
 * @throws 404 if the event does not exist.
 */
export const adminModerateEventRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate an event (admin)',
    description:
        'Sets the event moderation state (PENDING | APPROVED | REJECTED). Does not touch ' +
        'visibility, so approving does not publish and rejecting does not unpublish. ' +
        'Requires EVENT_MODERATION_CHANGE.',
    tags: ['Events', 'Admin'],
    requiredPermissions: [PermissionEnum.EVENT_MODERATION_CHANGE],
    requestParams: { id: EventIdSchema },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { moderationState } = ContentModerationChangeInputSchema.parse(body);

        const result = await eventService.moderate({
            actor,
            id: params.id as string,
            moderationState
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
