/**
 * Protected "list my venue listings" endpoint (SPEC-249 T-006).
 *
 * Returns the authenticated actor's OWN venue listings as lightweight
 * summaries for the web self-service area (`mi-cuenta/comercio`). Ownership is
 * the gate — `VenueService.listOwn` hard-scopes to `ownerId = actor.id`,
 * so a tourist or another owner simply gets an empty list.
 *
 * MUST be registered BEFORE the `/{id}` route so Hono does not treat the literal
 * `mine` path segment as an `:id` param.
 */
import { OwnerListingListSchema, VerticalEnum } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { buildOwnerListingSummaries } from '../../../services/listing-publication/owner-listing-summaries';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/protected/venues/mine
 * Lists the authenticated owner's own venue listings (summary view).
 */
export const protectedListMyVenueRoute = createProtectedRoute({
    method: 'get',
    path: '/mine',
    emailUnverifiedOperation: 'READ_OWN',
    summary: 'List my venue listings (protected)',
    description: "Returns the authenticated owner's own venue listings as summaries",
    tags: ['Venue'],
    responseSchema: OwnerListingListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await venueService.listOwn(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // HOS-2484: the summaries carry each unpublished listing's unmet
        // publish requirements, read in one batch (no per-listing request).
        const listings = await buildOwnerListingSummaries({
            vertical: VerticalEnum.VENUE,
            listings: result.data?.listings ?? []
        });

        return { listings };
    }
});
