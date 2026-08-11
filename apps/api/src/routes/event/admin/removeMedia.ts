/**
 * DELETE /api/v1/admin/events/:id/media/:mediaId
 * Remove (soft-delete) a photo from a event gallery (HOS-390).
 *
 * Soft-deletes the `event_media` row identified by `mediaId` and resequences the
 * remaining visible rows to a dense 0-based `sortOrder`. Both operations run in
 * a single transaction inside the service.
 *
 * Deletes the Cloudinary binary as well: the provider is passed down so the
 * asset is removed BEFORE the row, aborting the whole operation if storage
 * fails rather than leaving a permanently-billed orphan.
 *
 * Gated on EVENT_UPDATE, the broad grant — enforced inside
 * `removeEventMedia` via `checkEventCanEditMedia`.
 */
import { PermissionEnum, SuccessSchema } from '@repo/schemas';
import { EventService, removeEventMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific photo from a event gallery.
 */
export const adminRemoveEventMediaRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from event gallery (admin)',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. ' +
        'Requires EVENT_UPDATE.',
    tags: ['Event', 'Media'],
    requiredPermissions: [PermissionEnum.EVENT_UPDATE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: EventService.model is protected; cast to read it
        // rather than widen the service surface for one caller.
        const model = (eventService as unknown as { model: Parameters<typeof removeEventMedia>[0] })
            .model;

        const result = await removeEventMedia(
            model,
            actor,
            {
                eventId: params.id as string,
                mediaId: params.mediaId as string
            },
            getMediaProvider()
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
