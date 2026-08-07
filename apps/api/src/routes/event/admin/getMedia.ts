/**
 * GET /api/v1/admin/events/:id/media
 * List photos in a event gallery (HOS-390).
 *
 * Returns all non-deleted `event_media` rows for the given event, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 *
 * Gated on EVENT_UPDATE, the broad grant — enforced inside
 * `getEventMedia` via `checkEventCanEditMedia`. There is no separate public read
 * path for media management: public consumers read the composed `media` field
 * on the event.
 */
import { ContentMediaStateSchema, EventMediaListOutputSchema, PermissionEnum } from '@repo/schemas';
import { EventService, getEventMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — lists the gallery photos for an event.
 */
export const adminGetEventMediaRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List event gallery photos (admin)',
    description:
        'Retrieves all media rows for an event, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires EVENT_UPDATE.',
    tags: ['Event', 'Media'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: ContentMediaStateSchema.optional()
    },
    responseSchema: EventMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (eventService as unknown as { model: Parameters<typeof getEventMedia>[0] })
            .model;

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? ContentMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        const result = await getEventMedia(model, actor, {
            eventId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
