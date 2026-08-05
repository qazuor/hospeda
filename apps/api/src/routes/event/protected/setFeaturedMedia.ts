/**
 * PUT /api/v1/protected/events/:id/media/:mediaId/featured
 * Set the featured photo for a event gallery (HOS-390).
 *
 * Promotes the target `event_media` row to `is_featured = true` and demotes the
 * previous featured row (if any) back to `is_featured = false`. Both operations
 * run in a single DB transaction — clear-then-set order is mandatory to avoid
 * transiently violating the partial unique index on (event_id) WHERE
 * is_featured = true AND deleted_at IS NULL.
 *
 * The target media row MUST be `state = 'visible'` — archived photos are
 * rejected before reaching the DB (CHECK constraint guard).
 *
 * No request body — eventId and mediaId come from URL params.
 *
 * Gated on the same permission as editing the event itself — enforced inside
 * `setFeaturedEventMedia` via `checkEventCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention —
 * defensive only; see the reorder-route note.
 */
import { EventMediaSingleOutputSchema } from '@repo/schemas';
import { EventService, ServiceError, setFeaturedEventMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — promotes a photo to featured on an event.
 */
export const protectedSetFeaturedEventMediaRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for event gallery',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Archived photos cannot be featured — restore the ' +
        'photo to visible first. Requires the same permission as updating the event. ' +
        'No request body — ids come from URL params.',
    tags: ['Event', 'Event Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: EventMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (
            eventService as unknown as { model: Parameters<typeof setFeaturedEventMedia>[0] }
        ).model;

        const result = await setFeaturedEventMedia(model, actor, {
            eventId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
