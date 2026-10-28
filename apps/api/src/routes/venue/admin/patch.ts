/**
 * Admin patch venue listing endpoint (partial PATCH).
 * Allows admins to partially update any venue listing.
 */
import {
    VenueAdminSchema,
    type VenueUpdateInput,
    VenueUpdateInputSchema,
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
 * PATCH /api/v1/admin/venues/:id
 * Partial update venue listing — Admin endpoint.
 *
 * Uses the same `VenueUpdateInputSchema` (all fields partial) as the PUT
 * endpoint. Requires VENUE_EDIT_ALL permission.
 */
export const adminPatchVenueRoute = createAdminRoute({
    method: 'patch',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
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
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
