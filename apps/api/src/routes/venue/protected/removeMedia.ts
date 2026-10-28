/**
 * DELETE /api/v1/protected/venues/:id/media/:mediaId
 * Remove (soft-delete) a photo from a gastronomy listing gallery (HOS-372).
 *
 * Soft-deletes the `venue_media` row identified by `mediaId` and
 * resequences the remaining visible rows to a dense 0-based `sortOrder`.
 * Both operations run in a single transaction inside the service.
 *
 * Deletes the Cloudinary binary as well (HOS-372): the provider is passed down
 * so the asset is removed BEFORE the row, aborting the whole operation if
 * storage fails rather than leaving a permanently-billed orphan.
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff) —
 * enforced inside `removeVenueMedia` via `checkVenueCanEditMedia`.
 */

import { SuccessSchema, VerticalEnum } from '@repo/schemas';
import { removeVenueMedia, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific photo from a gastronomy listing gallery.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedRemoveVenueMediaRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from gastronomy listing gallery',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. ' +
        'Requires VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Gastronomy', 'Gastronomy Media'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof removeVenueMedia>[0] })
            .model;
        const result = await removeVenueMedia(
            model,
            actor,
            {
                venueId: params.id as string,
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
