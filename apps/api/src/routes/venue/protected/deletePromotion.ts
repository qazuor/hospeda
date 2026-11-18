/**
 * DELETE /api/v1/protected/venues/:id/promotions/:promotionId
 *
 * Soft-deletes a promotion of the venue (HOS-2270). Always allowed to the owner, even
 * after a plan downgrade: it is the `delete` intent of the `promotions` section, which
 * the pipeline lets through without the entitlement, and it requests no limit.
 *
 * @module routes/venue/protected/deletePromotion
 */
import { PermissionEnum, SuccessSchema, VerticalEnum } from '@repo/schemas';
import { ServiceError, VenuePromotionService } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { PROMOTIONS_SECTION_ID } from './promotion-access';
import { venuePromotionParams } from './putPromotion';

const venuePromotionService = new VenuePromotionService({ logger: apiLogger });

/** Deletes the promotion. Exported standalone so the route test can call it directly. */
export async function handleDeleteVenuePromotion(ctx: Context, params: Record<string, unknown>) {
    const result = await venuePromotionService.softDelete({
        actor: getActorFromContext(ctx),
        venueId: params.id as string,
        promotionId: params.promotionId as string
    });
    if (result.error) throw new ServiceError(result.error.code, result.error.message);
    return { success: true };
}

export const protectedDeleteVenuePromotionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/promotions/{promotionId}',
    summary: 'Delete a promotion of a venue listing',
    description:
        'Soft-deletes a promotion of the venue. Owner-only; 404 when the promotion does not hang from this venue. Not gated on create_promotions: putting away what the owner loaded is never a paid capability.',
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN],
    listingAccess: {
        operation: 'EDIT',
        vertical: VerticalEnum.VENUE,
        idParam: 'id',
        listingSection: { id: PROMOTIONS_SECTION_ID, intent: 'delete' }
    },
    tags: ['Venue', 'Venue Promotions'],
    protectedTag: false,
    requestParams: venuePromotionParams,
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleDeleteVenuePromotion(ctx, params)
});
