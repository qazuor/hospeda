/**
 * Protected publish-state event endpoint — HOS-374 §7.6.4.
 *
 * The trusted editor's own publication switch: raises or lowers `visibility`
 * on an event they authored, without touching the moderation verdict, so
 * unpublishing → editing → republishing never re-enters the review queue.
 *
 * Authorization lives entirely in `EventService.setPublishState()`, which
 * accepts either `EVENT_PUBLISH_TOGGLE` (any event) or `EVENT_PUBLISH_OWN` plus
 * authorship. The route declares no `requiredPermissions` because the
 * author-scoped half of that rule cannot be expressed without the event.
 *
 * @module routes/event/protected/publishState
 */
import { ContentPublishStateInputSchema, EventIdSchema, EventProtectedSchema } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/protected/events/:id/publish-state
 *
 * @throws 400 if `visibility` is not a valid visibility value.
 * @throws 403 if the actor is the author but lacks `EVENT_PUBLISH_OWN`.
 * @throws 404 if the event does not exist OR is authored by someone else (never
 *         403 on a foreign row: that would confirm the id exists, HOS-1106).
 */
export const protectedSetEventPublishStateRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish-state',
    summary: 'Set publication state of own event',
    description:
        'Publishes or unpublishes an event the actor authored. Requires EVENT_PUBLISH_OWN ' +
        '(or EVENT_PUBLISH_TOGGLE for any event). Leaves the moderation verdict intact.',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    requestBody: ContentPublishStateInputSchema,
    responseSchema: EventProtectedSchema,
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
