/**
 * PATCH /api/v1/protected/events/:id/media/:mediaId
 * Correct the text metadata of an event gallery photo (HOS-1036).
 *
 * The event twin of `accommodation/protected/updateMedia.ts` (HOS-388). Until this
 * route existed there was no way at all to write a photo's `alt` or `caption`
 * for an event: the editor never offered the fields, and the only "fix" was to
 * delete the photo and re-upload it — burning a second Cloudinary asset and
 * losing the photo's gallery position. A photo with no alt text is a photo a
 * screen reader cannot describe and a search engine cannot read.
 *
 * Pure TEXT metadata: `caption`, `description`, `alt`, `attribution`. It can
 * never touch `url`, `publicId`, `moderationState`, `state`, `isFeatured`,
 * `sortOrder` or `eventId` — those columns are not reachable from
 * `EventMediaUpdatePayloadSchema` even if the client sends them (Zod strips
 * unknown keys on a plain object schema).
 *
 * All four fields are nullable: omit a field to leave it untouched, send `null`
 * to clear it, send a value to replace it. At least one field must be present —
 * an empty body is rejected as `VALIDATION_ERROR`, not a silent 200.
 *
 * The MEDIA row is what is protected against existence probing: a row belonging to
 * another event, a non-existent id, or a soft-deleted row all answer `NOT_FOUND` (404)
 * — never `FORBIDDEN` (403), so a foreign media id cannot be confirmed to exist (see
 * `apps/api/docs/error-contract.md`).
 *
 * The PARENT event is NOT protected that way, and that is deliberate. The gate
 * (`checkEventCanEditMedia`) answers `FORBIDDEN` (403) on an event the actor may not
 * edit and `NOT_FOUND` (404) on one that does not exist, so an actor whose grant is
 * ownership-scoped (`EVENT_UPDATE_OWN` without `EVENT_UPDATE`) can tell a stranger's
 * event id from an invented one. The sibling media helpers — add, remove, reorder,
 * setFeatured and the media read — all share that same gate, so closing the gap in
 * `update` alone would leave `update` at 404 while `remove` stays at 403 on the very
 * same parent. It belongs to a follow-up covering all six helpers across the four
 * entities at once.
 */
import {
    EventMediaSingleOutputSchema,
    type EventMediaUpdatePayload,
    EventMediaUpdatePayloadSchema
} from '@repo/schemas';
import { EventService, ServiceError, updateEventMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — corrects a photo's text metadata on an event.
 *
 * Permission model: the service helper `updateEventMedia` gates on `checkEventCanEditMedia`, which delegates to `checkCanUpdateEvent` — editing an event's photo text IS editing the event, so it cannot require less.
 */
export const protectedUpdateEventMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/{mediaId}',
    summary: 'Correct photo text metadata in event gallery',
    description:
        'Patch caption/description/alt/attribution on an existing media row. ' +
        'Each field is nullable: omit to leave unchanged, null to clear, a value ' +
        'to replace. At least one field must be present — an empty body is a ' +
        'VALIDATION_ERROR, not a silent 200. Requires the same permission as updating the event.',
    tags: ['Event', 'Event Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: EventMediaUpdatePayloadSchema,
    responseSchema: EventMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const payload = body as EventMediaUpdatePayload;

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (eventService as unknown as { model: Parameters<typeof updateEventMedia>[0] })
            .model;

        const result = await updateEventMedia(model, actor, {
            eventId: params.id as string,
            mediaId: params.mediaId as string,
            caption: payload.caption,
            description: payload.description,
            alt: payload.alt,
            attribution: payload.attribution
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
