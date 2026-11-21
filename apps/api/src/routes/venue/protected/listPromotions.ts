/**
 * GET /api/v1/protected/venues/:id/promotions
 *
 * Lists the promotions of the venue, in any state, with the owner's quota usage
 * (HOS-2270). Owner-only. Not gated on `create_promotions`: an owner whose plan no
 * longer grants it still owns the rows and must be able to see and put them away.
 *
 * Answers `{ items, meta: { activeCount, maxActive } }`; `maxActive` is the
 * effective `max_active_promotions` of the venue vertical (`2147483647` is "no cap").
 *
 * @module routes/venue/protected/listPromotions
 */
import { toPromotionWindow, VenuePromotionListOutputSchema, VerticalEnum } from '@repo/schemas';
import { ServiceError, VenuePromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { readEffectiveLimit } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { MAX_ACTIVE_PROMOTIONS_KEY, PROMOTIONS_SECTION_ID } from './promotion-access';

const venuePromotionService = new VenuePromotionService({ logger: apiLogger });

/** Reads the list. Exported standalone so the route test can call it directly. */
export async function handleListVenuePromotions(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const result = await venuePromotionService.list({ actor, venueId: params.id as string });
    if (result.error) throw new ServiceError(result.error.code, result.error.message);
    const maxActive = await readEffectiveLimit({
        userId: actor.id,
        vertical: VerticalEnum.VENUE,
        key: MAX_ACTIVE_PROMOTIONS_KEY
    });
    return {
        items: result.data.items.map(({ windowWeekdays, windowStart, windowEnd, ...item }) => ({
            ...item,
            window: toPromotionWindow({ windowWeekdays, windowStart, windowEnd })
        })),
        meta: { activeCount: result.data.activeCount, maxActive }
    };
}

export const protectedListVenuePromotionsRoute = createProtectedRoute({
    method: 'get',
    emailUnverifiedOperation: 'READ_OWN',
    path: '/{id}/promotions',
    summary: 'List the promotions of a venue listing',
    description:
        'Returns every promotion of the venue in any state, newest first, with the owner quota counters. Owner-only. Not gated on create_promotions: reading what the owner already loaded is never a paid capability.',
    // No `requiredPermissions` here on purpose: this is a closed-list READ_OWN route and
    // the unverified-email guard (TEST:1692:7) forbids naming permissions on it. The
    // permission is checked all the same, by `VenuePromotionService.list` (`checkCanList`:
    // OWNER_PROMOTION_VIEW_OWN or _ANY) after the listing-access pipeline.
    listingAccess: {
        operation: 'READ_OWN',
        vertical: VerticalEnum.VENUE,
        idParam: 'id',
        listingSection: { id: PROMOTIONS_SECTION_ID, intent: 'read' }
    },
    tags: ['Venue', 'Venue Promotions'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenuePromotionListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleListVenuePromotions(ctx, params)
});
