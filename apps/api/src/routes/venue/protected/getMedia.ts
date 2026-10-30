/**
 * GET /api/v1/protected/venues/:id/media
 * List photos in a venue listing gallery (HOS-372).
 *
 * Returns all non-deleted media rows for the given listing, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 *
 * Gated on VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff) —
 * enforced inside `getVenueMedia` via `checkVenueCanEditMedia`. There
 * is no separate public read path for media management.
 */
import { VenueMediaListOutputSchema, VenueMediaStateSchema } from '@repo/schemas';
import { getVenueMedia, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Route handler — lists the gallery photos for a venue listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone media helper without requiring a public accessor.
 */
export const protectedGetVenueMediaRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List venue listing gallery photos',
    description:
        'Retrieves all media rows for a venue listing, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires VENUE_EDIT_OWN (listing owner) or VENUE_EDIT_ALL (staff).',
    tags: ['Venue', 'Venue Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: VenueMediaStateSchema.optional()
    },
    responseSchema: VenueMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? VenueMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (venueService as unknown as { model: Parameters<typeof getVenueMedia>[0] })
            .model;
        const result = await getVenueMedia(model, actor, {
            venueId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
