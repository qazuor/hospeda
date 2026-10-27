/**
 * Admin update gastronomy listing endpoint (full PUT).
 * Allows admins to update any gastronomy listing.
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
 * PUT /api/v1/admin/venues/:id
 * Update gastronomy listing — Admin endpoint.
 *
 * Requires VENUE_EDIT_ALL permission. The service layer (`_canUpdate`)
 * enforces the same gate, providing defense in depth.
 */
export const adminUpdateVenueRoute = createAdminRoute({
    method: 'put',
    listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id' },
    path: '/{id}',
    summary: 'Update gastronomy listing (admin)',
    description: 'Updates a gastronomy listing. Requires VENUE_EDIT_ALL permission.',
    tags: ['Gastronomy'],
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
        const { id } = params;
        const data = body as VenueUpdateInput;

        const result = await runListingContentCall({
            ctx,
            run: () => venueService.update(actor, id as string, data)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
