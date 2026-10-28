/**
 * PUT /api/v1/protected/venues/:id/media/:mediaId/featured
 * Set the featured photo for a gastronomy listing gallery (HOS-372).
 *
 * Promotes the target `venue_media` row to `is_featured = true` and
 * demotes the previous featured row (if any) back to `is_featured = false`.
 * Both operations run in a single DB transaction — clear-then-set order is
 * mandatory to avoid transiently violating the partial unique index on
 * (venue_id) WHERE is_featured = true AND deleted_at IS NULL.
 *
 * The target media row MUST be `state = 'visible'` — archived photos are
 * rejected before reaching the DB (CHECK constraint guard).
 *
 * No request body — venueId and mediaId come from URL params.
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff) —
 * enforced inside `setFeaturedVenueMedia` via `checkVenueCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention.
 * That is defensive, not required — the two paths differ in segment count, and
 * Hono resolves the static `featured` segment regardless of insertion order
 * (mirrors the reorder-route note).
 */

import { VenueMediaSingleOutputSchema, VerticalEnum } from '@repo/schemas';
import { ServiceError, setFeaturedVenueMedia, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — promotes a photo to featured on a gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedSetFeaturedVenueMediaRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for gastronomy listing gallery',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Archived photos cannot be featured — restore the ' +
        'photo to visible first. Requires VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff). ' +
        'No request body — ids come from URL params.',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    tags: ['Venue', 'Gastronomy Media'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            venueService as unknown as {
                model: Parameters<typeof setFeaturedVenueMedia>[0];
            }
        ).model;
        const result = await setFeaturedVenueMedia(model, actor, {
            venueId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
