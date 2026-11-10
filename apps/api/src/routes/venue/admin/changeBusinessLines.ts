/**
 * PATCH /api/v1/admin/venues/{id}/business-lines — administrative action 27
 * (ACC:27, HOS-1875).
 *
 * A support member or admin changes the business lines of somebody else's venue
 * listing. Action 15 edits content and rejects `businessLines` (it is
 * classification, DEC-FAC-074), so the change has its own route and its own
 * action, gated by `VENUE_EDIT_ALL` on the listing's owner.
 *
 * No `requiredPermissions`: the action's own permission is decided by the V5
 * chain (step 3) from the `ACC_27` row, exactly like `purge.ts` with `ACC_23`.
 * No `listingSection`: the body writes no section; the sections that appear or
 * disappear follow from the lines and are the notice's subject, not this route's.
 *
 * The service's `update` owns the type ↔ business-line validation and the
 * register + owner email; `runListingContentCall` opens the ACC:27 scope step 3
 * permitted so those side effects run.
 */
import {
    VenueAdminSchema,
    type VenueBusinessLinesChangeInput,
    VenueBusinessLinesChangeInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/venues/:id/business-lines
 * Change the business lines of a venue listing — administrative action 27.
 *
 * Requires `VENUE_EDIT_ALL`. The owner of the listing is the subject; the
 * action refuses the actor when it is the owner (an owner edits her own lines
 * through the general PATCH).
 */
export const adminChangeVenueBusinessLinesRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/business-lines',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'EDIT',
        idParam: 'id',
        administrativeAction: 'ACC_27'
    },
    summary: 'Change the business lines of a venue listing (ACC:27)',
    description:
        'Administrative action 27: changes the business lines of another owner venue listing. Requires VENUE_EDIT_ALL, evaluated on the owner. Records the change on the listing timeline and notifies the owner by email.',
    tags: ['Venues', 'Admin'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: VenueBusinessLinesChangeInputSchema,
    responseSchema: VenueAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { businessLines } = body as VenueBusinessLinesChangeInput;

        const result = await runListingContentCall({
            ctx,
            run: () => venueService.update(actor, id, { businessLines })
        });

        if (result.error) {
            // Carry the machine-readable reason: the error contract publishes
            // `details` for `BUSINESS_LINES_INVALID` only when the rebuilt error
            // keeps it (`handleRouteError` gate).
            throw new ServiceError(
                result.error.code,
                result.error.message,
                result.error.details,
                result.error.reason
            );
        }

        return result.data;
    }
});
