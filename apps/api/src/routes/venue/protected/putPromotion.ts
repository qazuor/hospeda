/**
 * PUT /api/v1/protected/venues/:id/promotions/:promotionId
 *
 * Edits a promotion of the venue (HOS-2270). The promotion must hang from THIS
 * venue: one of another venue, of an accommodation, or one that does not exist is a
 * 404, never a 403.
 *
 * Plan downgrades (HOS-2253 decision 6, owner decision 2026-11-18): what the owner
 * already loaded keeps running until it expires. Pausing (a body that is only
 * `{ lifecycleState }` other than ACTIVE) never needs the plan; creating, editing and
 * re-activating need `create_promotions` and, when the promotion ends up active, room
 * under `max_active_promotions`. A promotion that stays or becomes «Solo VIP» and
 * live also needs `vip_only_promotions` (HOS-2589 D-4, 403 ENTITLEMENT_REQUIRED).
 *
 * @module routes/venue/protected/putPromotion
 */
import { ownerPromotionModel } from '@repo/db';
import {
    PermissionEnum,
    toPromotionWindow,
    VenuePromotionProtectedSchema,
    VenuePromotionUpdateRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenuePromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { enforceVipOnlyPromotionGate } from '../../owner-promotion/vip-only-gate';
import { PROMOTIONS_SECTION_ID, promotionEditIntent, promotionEditLimit } from './promotion-access';

const venuePromotionService = new VenuePromotionService({ logger: apiLogger });

/** Edits the promotion. Shared with PATCH and exported so tests can call it directly. */
export async function handleEditVenuePromotion(
    ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);
    const venueId = params.id as string;
    const promotionId = params.promotionId as string;
    // HOS-2589 D-4/D-8: a promotion that stays or becomes «Solo VIP» and live needs
    // `vip_only_promotions`. A promotion that is not this owner's venue's is left to
    // the service, which answers its 404 before any entitlement check.
    const existing = await ownerPromotionModel.findOneOfVenue({ promotionId, venueId });
    const vipOnlyVerified =
        existing && existing.ownerId === actor.id
            ? await enforceVipOnlyPromotionGate({
                  userId: actor.id,
                  vertical: VerticalEnum.VENUE,
                  body,
                  existing
              })
            : false;
    const result = await venuePromotionService.update({
        actor,
        venueId,
        promotionId,
        // The route validated the body against `VenuePromotionUpdateRequestSchema`.
        request: body as never,
        vipOnlyVerified
    });
    if (result.error) throw new ServiceError(result.error.code, result.error.message);
    const { windowWeekdays, windowStart, windowEnd, ...item } = result.data;
    return { ...item, window: toPromotionWindow({ windowWeekdays, windowStart, windowEnd }) };
}

/** Path parameters shared by PUT, PATCH and DELETE. */
export const venuePromotionParams = {
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    promotionId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
};

export const protectedPutVenuePromotionRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}/promotions/{promotionId}',
    summary: 'Edit a promotion of a venue listing',
    description:
        'Edits a promotion of the venue. Owner-only; the promotion must hang from this venue (404 otherwise). Needs create_promotions and, when the promotion ends up active, room under max_active_promotions. A body that is only a non-ACTIVE lifecycleState is a pause and needs neither.',
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
