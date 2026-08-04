/**
 * Protected get-own-event-by-ID endpoint — HOS-374 §5.2.2.
 *
 * The event twin of `post/protected/getById.ts`. See that file for why this
 * exists instead of reusing the public route: the public one is cached
 * (`cacheTTL`), so serving an actor-shaped response through it would cache one
 * author's unpublished draft and hand it to the next caller.
 *
 * @module routes/event/protected/getById
 */
import { EventIdSchema, EventProtectedSchema, PermissionEnum } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/protected/events/:id
 *
 * @throws 403 if the actor is neither the author nor a holder of EVENT_VIEW_ALL.
 * @throws 404 if the event does not exist.
 */
export const protectedGetEventByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own event by ID',
    description:
        'Retrieves an event the actor authored, in any moderation and lifecycle state. ' +
        'Requires authorship or EVENT_VIEW_ALL.',
    tags: ['Events'],
    requestParams: { id: EventIdSchema },
    responseSchema: EventProtectedSchema.nullable(),
    ownership: {
        entityType: 'event',
        ownershipFields: ['authorId'],
        bypassPermission: PermissionEnum.EVENT_VIEW_ALL
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await eventService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
