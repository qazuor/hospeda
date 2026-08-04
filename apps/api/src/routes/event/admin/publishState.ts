/**
 * Admin publish-state event endpoint — HOS-374 §7.6.4.
 *
 * Raises or lowers an event's publication by writing `visibility` and nothing
 * else, so unpublishing never discards the moderation verdict.
 *
 * Publish and unpublish are one permission on purpose: "may publish but may not
 * unpublish" would let someone push content live with no way to pull it back.
 *
 * @module routes/event/admin/publishState
 */
import {
    ContentPublishStateInputSchema,
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
 * POST /api/v1/admin/events/:id/publish-state
 *
 * @throws 400 if `visibility` is not a valid visibility value.
 * @throws 403 if the actor lacks `EVENT_PUBLISH_TOGGLE`.
 * @throws 404 if the event does not exist.
 */
export const adminSetEventPublishStateRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/publish-state',
    summary: 'Set post publication state (admin)',
    description:
        'Sets the event visibility (PUBLIC | PRIVATE | RESTRICTED). Leaves the moderation ' +
        'verdict intact, so republishing does not re-enter the review queue. ' +
        'Requires EVENT_PUBLISH_TOGGLE.',
    tags: ['Events', 'Admin'],
    requiredPermissions: [PermissionEnum.EVENT_PUBLISH_TOGGLE],
    requestParams: { id: EventIdSchema },
    requestBody: ContentPublishStateInputSchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { visibility } = ContentPublishStateInputSchema.parse(body);

        const result = await eventService.setPublishState({
            actor,
            id: params.id as string,
            visibility
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
