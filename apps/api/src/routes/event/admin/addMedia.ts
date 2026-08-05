/**
 * POST /api/v1/admin/events/:id/media
 * Add a photo to a event gallery (HOS-390).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via the media-upload endpoint. This endpoint registers the returned
 * URL + metadata as a new `event_media` row.
 *
 * Gated on EVENT_UPDATE, the broad grant — enforced inside
 * `addEventMedia` via `checkEventCanEditMedia`.
 */
import {
    type EventMediaAddInput,
    type EventMediaAddPayload,
    EventMediaAddPayloadSchema,
    EventMediaSingleOutputSchema,
    PermissionEnum
} from '@repo/schemas';
import { addEventMedia, EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — adds a photo to the specified event's gallery.
 */
export const adminAddEventMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to event gallery (admin)',
    description:
        'Registers an already-uploaded URL as a new event_media row. ' + 'Requires EVENT_UPDATE.',
    tags: ['Event', 'Media'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: EventMediaAddPayloadSchema,
    responseSchema: EventMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (eventService as unknown as { model: Parameters<typeof addEventMedia>[0] })
            .model;

        const input: EventMediaAddInput = {
            eventId: params.id as string,
            media: body as EventMediaAddPayload
        };

        const result = await addEventMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
