/**
 * Public read of a venue's current PLUS promotions (HOS-2271). Since HOS-2589
 * (AC-10) a non-VIP reader gets at most the free quota in full, so the answer is
 * per-actor and the venue detail page reads `/public/owner-promotions/visible`.
 */
import { ownerPromotionModel } from '@repo/db';
import { ServiceErrorCode, toPromotionWindow, VenuePromotionPublicListSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { markPerActorResponse } from '../../owner-promotion/public/promotion-visibility';
import { keepOnlyFreelyVisible } from '../../owner-promotion/tourist-promotion-access';

const venueService = new VenueService({ logger: apiLogger });

/** GET /api/v1/public/venues/{venueId}/promotions. */
export const publicGetVenuePromotionsRoute = createPublicRoute({
    method: 'get',
    path: '/{venueId}/promotions',
    summary: 'List active public promotions for a venue',
    description:
        'Returns current PLUS promotions for a published venue without session-specific data.',
    tags: ['Venue', 'Venue promotions'],
    requestParams: {
        venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenuePromotionPublicListSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        markPerActorResponse({ ctx });
        const venueResult = await venueService.getById(actor, params.venueId as string);
        if (venueResult.error)
            throw new ServiceError(venueResult.error.code, venueResult.error.message);
        if (venueResult.data?.publicationStatus !== 'PUBLISHED') {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Venue not found');
        }
        // HOS-2589 AC-10: a non-VIP reader gets only what the free policy shows in full.
        const items = await keepOnlyFreelyVisible({
            actor,
            items: await ownerPromotionModel.findActiveForVenue({
                venueId: params.venueId as string
            })
        });
        return {
            items: items.map(
                ({
                    id,
                    title,
                    description,
                    discountType,
                    discountValue,
                    validFrom,
                    validUntil,
                    windowWeekdays,
                    windowStart,
                    windowEnd
                }) => ({
                    id,
                    title,
                    description,
                    discountType,
                    discountValue,
                    validFrom,
                    validUntil,
                    window: toPromotionWindow({ windowWeekdays, windowStart, windowEnd })
                })
            )
        };
    },
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
