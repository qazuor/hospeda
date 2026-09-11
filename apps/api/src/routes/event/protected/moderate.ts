/**
 * Protected moderate event endpoint — HOS-1037.
 *
 * The trusted editor's self-approve switch: raises `moderationState` to
 * `APPROVED` on an event they authored, without touching `visibility`. Before
 * this route existed, "Editor de confianza" granted `EVENT_PUBLISH_OWN` and
 * `EVENT_DELETE_OWN` but nothing could ever clear an event out of `PENDING` —
 * `visibility` was already `PUBLIC` from creation, so the only control the
 * author had (the publish-state toggle) moved a value that was never the
 * blocker.
 *
 * Authorization lives entirely in `EventService.moderate()` /
 * `checkCanModerateEvent()`, which accepts either `EVENT_MODERATION_CHANGE`
 * (the admin queue, any event, any verdict) or authorship plus
 * `EVENT_PUBLISH_OWN` when the requested verdict is `APPROVED`. A trusted
 * editor may approve their own content but may not self-reject or push it
 * back to `PENDING` — those stay platform-only, same as before. The route
 * declares no `requiredPermissions` because the author-scoped half of that
 * rule cannot be expressed without the event, and `EventService.moderate()`
 * masks a foreign-row refusal into 404 so this route never confirms that an
 * event belonging to someone else exists.
 *
 * @module routes/event/protected/moderate
 */
import {
    ContentModerationChangeInputSchema,
    EventIdSchema,
    EventProtectedSchema
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/protected/events/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor is the author but lacks `EVENT_PUBLISH_OWN`, or
 *         requests a verdict other than `APPROVED`.
 * @throws 404 if the event does not exist, or belongs to another author.
 */
export const protectedModerateEventRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Approve own event (trusted editor)',
    description:
        'Sets the moderation state of an event the actor authored. Requires EVENT_PUBLISH_OWN ' +
        '(or EVENT_MODERATION_CHANGE for any event/verdict). The author path only accepts ' +
        'APPROVED. Leaves visibility intact.',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: EventProtectedSchema,
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
