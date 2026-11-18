/**
 * PATCH /api/v1/protected/venues/:id/promotions/:promotionId
 *
 * Partially edits a promotion of the venue, including the pause (`{ lifecycleState:
 * 'ARCHIVED' }`) and the re-activation (HOS-2270). Same contract, gate and errors as
 * the PUT: see {@link ./putPromotion}.
 *
 * @module routes/venue/protected/patchPromotion
 */
import {
    PermissionEnum,
    VenuePromotionProtectedSchema,
    VenuePromotionUpdateRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';

import { createProtectedRoute } from '../../../utils/route-factory';
import { PROMOTIONS_SECTION_ID, promotionEditIntent, promotionEditLimit } from './promotion-access';
import { handleEditVenuePromotion, venuePromotionParams } from './putPromotion';

export const protectedPatchVenuePromotionRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/promotions/{promotionId}',
    summary: 'Partially edit a promotion of a venue listing',
    description:
        'Partially edits a promotion of the venue; a body that is only a non-ACTIVE lifecycleState pauses it and needs neither create_promotions nor limit room. Re-activating, or any other change, needs create_promotions and room under max_active_promotions. Owner-only; 404 when the promotion does not hang from this venue.',
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_UPDATE_OWN],
    listingAccess: {
        operation: 'EDIT',
        vertical: VerticalEnum.VENUE,
        idParam: 'id',
        listingSection: ({ body }) => [
            { id: PROMOTIONS_SECTION_ID, intent: promotionEditIntent({ body }) }
        ],
        limit: ({ ctx, listingId, subjectId, body }) =>
            promotionEditLimit({
                promotionId: ctx.req.param('promotionId'),
                venueId: listingId,
                subjectId,
                body
            })
    },
    tags: ['Venue', 'Venue Promotions'],
    protectedTag: false,
    requestParams: venuePromotionParams,
    requestBody: VenuePromotionUpdateRequestSchema,
    responseSchema: VenuePromotionProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handleEditVenuePromotion(ctx, params, body)
});
