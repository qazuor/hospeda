/**
 * GET /api/v1/protected/venues/:id/menu
 *
 * The owner's view of the venue's carta (HOS-895) — the structured sections and
 * dishes, plus whichever of the two fallbacks are set (the uploaded photo/PDF
 * and the external link).
 *
 * ## Why this read carries NO entitlement gate
 *
 * `MANAGE_VENUE_MENU` gates BUILDING a structured carta, not looking at
 * one. Two ordinary situations make the difference matter:
 *
 *  - A `-basico` owner opens the editor. They must see the menu section, the
 *    link field and the uploaded file — those work on every venue tier —
 *    with only the structured half disabled. A gate here would answer 403 and
 *    the editor would have nothing to render.
 *  - An owner whose subscription lapsed after they typed forty dishes. Their
 *    carta is still their data; refusing to show it back to them would be the
 *    platform holding it hostage.
 *
 * The write route is where the tier is enforced.
 *
 * @module routes/venue/protected/getMenu
 */
import { VenueMenuOutputSchema, VerticalEnum } from '@repo/schemas';
import { getVenueMenu, VenueService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/** Reads the carta. Exported standalone so the route test can call it directly. */
export async function handleGetVenueMenu(_ctx: Context, params: Record<string, unknown>) {
    const venueId = params.id as string;

    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the FAQ and media routes use.
    const model = (venueService as unknown as { model: Parameters<typeof getVenueMenu>[0] }).model;
    const result = await getVenueMenu(model, { venueId });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetVenueMenuRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/menu',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'READ_OWN',
        idParam: 'id',
        listingSection: { id: 'menu', intent: 'read' }
    },
    summary: 'Read the menu of a venue listing',
    description:
        "Returns the listing's structured menu (sections and dishes) together with the uploaded photo/PDF and the external menu link, if set. Owner-only. Not gated on the structured-menu entitlement: every venue tier can see its own menu, and only writing the structured half is a paid capability.",
    tags: ['Venue', 'Venue Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueMenuOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetVenueMenu(ctx, params)
});
