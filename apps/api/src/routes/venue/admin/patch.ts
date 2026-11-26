/**
 * Admin patch venue listing endpoint (partial PATCH).
 * Allows admins to partially update any venue listing.
 *
 * ## Section gate (HOS-1874)
 *
 * Declares `listingSection` from the listing catalog, so the access chain runs
 * step 4b and step 6 on the listing OWNER for an administrative edit (action
 * 15), exactly like the owner route. Writing fields of a section that the
 * listing's business lines do not offer answers 409 `SECTION_ABSENT`; a section
 * whose entitlement key the owner lacks answers 403 `ENTITLEMENT_REQUIRED`. A
 * body that only clears fields (`null`) declares no section and writes through,
 * because `null` never counts as a touch.
 *
 * ## Entry note translations (HOS-2658)
 *
 * The service writes only `entryNoteI18n.es` (the Spanish source, AC-25). The
 * `en` / `pt` a staff edit sends are an explicit correction, so the handler
 * persists every changed one as a MANUAL pair through the single translation
 * writer (`applyStaffEntryNotePairs`) instead of dropping it.
 */
import {
    sectionsTouchedByBody,
    VenueAdminSchema,
    type VenueUpdateInput,
    VenueUpdateInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { applyStaffEntryNotePairs } from '../../../services/translation/staff-entry-note-pairs';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/venues/:id
 * Partial update venue listing — Admin endpoint.
 *
 * Uses the same `VenueUpdateInputSchema` (all fields partial) as the PUT
 * endpoint. Requires VENUE_EDIT_ALL permission.
 */
export const adminPatchVenueRoute = createAdminRoute({
    method: 'patch',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'EDIT',
        idParam: 'id',
        listingSection: ({ body }) =>
            sectionsTouchedByBody({ vertical: 'venue', body }).map((id) => ({
                id,
                intent: 'write' as const
            }))
    },
    path: '/{id}',
    summary: 'Partial update venue listing (admin)',
    description: 'Updates specific fields of a venue listing. Requires VENUE_EDIT_ALL permission.',
    tags: ['Venue'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: VenueUpdateInputSchema,
    responseSchema: VenueAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const data = body as VenueUpdateInput;

        const result = await runListingContentCall({
            ctx,
            run: () => venueService.update(actor, id, data)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        // HOS-2658: the service writes only `entryNoteI18n.es` (AC-25); a staff
        // edit's `en`/`pt` are persisted as MANUAL pairs by the single writer.
        const { venue } = await applyStaffEntryNotePairs({
            venueId: id,
            body: data.entryNoteI18n,
            // TYPE-WORKAROUND: the Venue type has no index signature, and the helper only refreshes the two translation columns on it.
            updated: result.data as unknown as Record<string, unknown>
        });
        return venue;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
