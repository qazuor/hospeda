/**
 * Admin create accommodation endpoint
 * Allows admins to create new accommodations
 */
import {
    AccommodationAdminSchema,
    type AccommodationCreateInput,
    AccommodationCreateInputSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { runListingContentCall } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations
 * Create accommodation - Admin endpoint
 */
export const adminCreateAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create accommodation',
    description: 'Creates a new accommodation. Admin only.',
    tags: ['Accommodations'],
    // Own create: `ACCOMMODATION_CREATE` (re-checked by the listing-access middleware). Create on behalf of
    // another owner (`ownerId` ≠ actor) is action 15 (ACC:15, H12): the listing
    // access chain demands LISTING_FOREIGN_CONTENT_EDIT and runs steps 5 to 7 on
    // that owner, so holding `ACCOMMODATION_CREATE` alone never creates for somebody else.
    anyOfPermissions: [
        [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
    ],
    listingAccess: {
        vertical: VerticalEnum.ACCOMMODATION,
        operation: 'CREATE',
        createSubjectFromBody: 'ownerId',
        ownCreatePermission: PermissionEnum.ACCOMMODATION_CREATE
    },
    requestBody: AccommodationCreateInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as AccommodationCreateInput;

        const result = await runListingContentCall({
            ctx,
            run: () => accommodationService.create(actor, data)
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
