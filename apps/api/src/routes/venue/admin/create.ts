/**
 * Admin create gastronomy endpoint
 * Allows admins to create new gastronomy listings.
 */
import {
    PermissionEnum,
    type VenueAdminCreateInput,
    VenueAdminCreateInputSchema,
    VenueAdminSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * POST /api/v1/admin/venues
 * Create gastronomy listing — Admin endpoint.
 *
 * Requires VENUE_CREATE permission.
 */
export const adminCreateVenueRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create gastronomy listing',
    description: 'Creates a new gastronomy listing. Requires VENUE_CREATE permission.',
    tags: ['Gastronomy'],
    // Own create: `VENUE_CREATE` (re-checked by the listing-access middleware). Create on behalf of
    // another owner (`ownerId` ≠ actor) is action 15 (ACC:15, H12): the listing
    // access chain demands LISTING_FOREIGN_CONTENT_EDIT and runs steps 5 to 7 on
    // that owner, so holding `VENUE_CREATE` alone never creates for somebody else.
    anyOfPermissions: [[PermissionEnum.VENUE_CREATE, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]],
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'CREATE',
        createSubjectFromBody: 'ownerId',
        ownCreatePermission: PermissionEnum.VENUE_CREATE
    },
    requestBody: VenueAdminCreateInputSchema,
    responseSchema: VenueAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as VenueAdminCreateInput;

        const result = await runListingContentCall({
            ctx,
            run: () => venueService.create(actor, data)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
