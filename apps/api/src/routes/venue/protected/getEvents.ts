/**
 * GET /api/v1/protected/venues/:id/events
 *
 * The owner's view of the venue's own agenda (HOS-1042) — every entry, in
 * order, `isActive: false` ones included.
 *
 * ## Why this read carries NO entitlement gate
 *
 * Exactly the position `getMenu.ts` takes, and for one of its two reasons
 * rather than both.
 *
 * The reason that does NOT carry over: there is no ungated fallback here. A
 * `-basico` owner has no external-link or uploaded-photo half of an agenda to
 * keep working, so this read answers them an empty list and their editor shows
 * the upsell.
 *
 * The reason that does: an owner whose subscription lapsed after typing a
 * season of events still owns those rows. Refusing to show them back would be
 * the platform holding their data hostage, and it would also mean that
 * resubscribing looked like starting over. So the read stays open, the write is
 * where the tier is enforced, and the public page is where the display is
 * withheld.
 *
 * @module routes/venue/protected/getEvents
 */
import { VenueEventsOutputSchema, VerticalEnum } from '@repo/schemas';
import { getVenueEvents, VenueService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/** Reads the agenda. Exported standalone so the route test can call it directly. */
export async function handleGetVenueEvents(_ctx: Context, params: Record<string, unknown>) {
    const venueId = params.id as string;

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ, media and menu routes use.
    const model = (venueService as unknown as { model: Parameters<typeof getVenueEvents>[0] })
        .model;
    const result = await getVenueEvents(model, { venueId });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetVenueEventsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/events',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'READ_OWN',
        idParam: 'id',
        listingSection: { id: 'venueEvents', intent: 'read' }
    },
    summary: 'Read the venue events agenda of a venue listing',
    description:
        "Returns the listing's own events — live music night, happy hour, dinner show — in display order, including entries the owner has switched off. Owner-only. Not gated on the venue-events entitlement: an owner whose plan no longer grants it still owns the rows, and only writing is a paid capability.",
    tags: ['Venue', 'Venue Events'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueEventsOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetVenueEvents(ctx, params)
});
