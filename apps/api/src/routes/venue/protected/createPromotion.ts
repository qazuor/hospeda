/**
 * POST /api/v1/protected/venues/:id/promotions
 *
 * Creates a promotion of the venue (HOS-2270). The owner, the target type and the
 * target id are fixed by the session and the path, never read from the body.
 *
 * ## What it answers, and in what order
 *
 * 1. 401 without a session; 403 without the `OWNER_PROMOTION_CREATE` permission.
 * 2. 400 for a body that is not a venue promotion (`minNights`, `accommodationId`,
 *    a `free_night`, a `special_offer` without text...).
 * 3. 404 when the venue is not the caller's, same as when it does not exist.
 * 4. 403 `ENTITLEMENT_REQUIRED` without `create_promotions` in the venue vertical, or
 *    without coverage.
 * 5. 403 `LIMIT_REACHED` when the owner holds `max_active_promotions` venue promotions.
 * 6. 403 `ENTITLEMENT_REQUIRED` (`vip_only_promotions`) for a «Solo VIP» promotion
 *    when the owner's plan lacks the key (HOS-2589 D-4).
 * 7. 400 `VALIDATION_ERROR` when a `special_offer` text is refused by moderation.
 *
 * @module routes/venue/protected/createPromotion
 */
import {
    PermissionEnum,
    toPromotionWindow,
    VenuePromotionCreateRequestSchema,
    VenuePromotionProtectedSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, VenuePromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { enforceVipOnlyPromotionGate } from '../../owner-promotion/vip-only-gate';
import { PROMOTIONS_SECTION_ID, promotionCreateLimit } from './promotion-access';

const venuePromotionService = new VenuePromotionService({ logger: apiLogger });

/** Creates the promotion. Exported standalone so the route test can call it directly. */
export async function handleCreateVenuePromotion(
    ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) {
    const actor = getActorFromContext(ctx);
    // HOS-2589 D-4: «Solo VIP» needs `vip_only_promotions` in the venue vertical.
    await enforceVipOnlyPromotionGate({ userId: actor.id, vertical: VerticalEnum.VENUE, body });
    const result = await venuePromotionService.create({
        actor,
        venueId: params.id as string,
        // The route validated the body against `VenuePromotionCreateRequestSchema`.
        request: body as never
    });
    if (result.error) throw new ServiceError(result.error.code, result.error.message);
    const { windowWeekdays, windowStart, windowEnd, ...item } = result.data;
    return { ...item, window: toPromotionWindow({ windowWeekdays, windowStart, windowEnd }) };
}

export const protectedCreateVenuePromotionRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/promotions',
    summary: 'Create a promotion of a venue listing',
    description:
        'Creates a promotion that hangs from the venue: a percentage, a fixed amount, or a free-text special offer (moderated). Owner-only. Requires the create_promotions entitlement and room under max_active_promotions in the venue vertical. The owner and the target are fixed by the route; a «Solo VIP» audience also needs vip_only_promotions.',
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_CREATE],
    listingAccess: {
        operation: 'EDIT',
        vertical: VerticalEnum.VENUE,
        idParam: 'id',
        listingSection: { id: PROMOTIONS_SECTION_ID, intent: 'write' },
        limit: ({ subjectId }) => promotionCreateLimit({ subjectId })
    },
    tags: ['Venue', 'Venue Promotions'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: VenuePromotionCreateRequestSchema,
    responseSchema: VenuePromotionProtectedSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        handleCreateVenuePromotion(ctx, params, body)
});
