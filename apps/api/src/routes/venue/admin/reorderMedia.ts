/**
 * PATCH /api/v1/admin/venues/:id/media/reorder
 * Reorder photos in a gastronomy listing gallery — Admin endpoint (HOS-372).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * `index.ts` registers this before /{id}/media/{mediaId} by convention. That is
 * defensive, not required — Hono resolves the static `reorder` segment ahead of
 * the `{mediaId}` param regardless of insertion order (verified by mutation on
 * the post/event twin, `test/routes/post-protected-media.test.ts`).
 */
import {
    VenueMediaListOutputSchema,
    type VenueMediaReorderPayload,
    VenueMediaReorderPayloadSchema,
    VerticalEnum
} from '@repo/schemas';
import { reorderVenueMedia, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/venues/:id/media/reorder
 * Reorder gastronomy listing gallery photos — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service helper
 * `reorderVenueMedia` enforces the same gate via `checkVenueCanEditMedia`.
 */
export const adminReorderVenueMediaRoute = createAdminRoute({
    method: 'patch',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}/media/reorder',
    summary: 'Reorder gastronomy listing gallery photos (admin)',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires VENUE_EDIT_ALL.',
    tags: ['Gastronomy', 'Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: VenueMediaReorderPayloadSchema,
    responseSchema: VenueMediaListOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            venueService as unknown as { model: Parameters<typeof reorderVenueMedia>[0] }
        ).model;
        const result = await runListingContentCall({
            ctx,
            run: () =>
                reorderVenueMedia(model, actor, {
                    venueId: params.id as string,
                    orderedIds: (body as VenueMediaReorderPayload).orderedIds
                })
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
