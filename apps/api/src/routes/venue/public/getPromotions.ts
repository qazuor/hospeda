/** Public, session-blind read of a venue's current PLUS promotions (HOS-2271). */
import { ownerPromotionModel } from '@repo/db';
import { ServiceErrorCode, VenuePromotionPublicListSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

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
        const venueResult = await venueService.getById(actor, params.venueId as string);
        if (venueResult.error)
            throw new ServiceError(venueResult.error.code, venueResult.error.message);
        if (venueResult.data?.publicationStatus !== 'PUBLISHED') {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Venue not found');
        }
        const items = await ownerPromotionModel.findActiveForVenue({
            venueId: params.venueId as string
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
                    validUntil
                }) => ({
                    id,
                    title,
                    description,
                    discountType,
                    discountValue,
                    validFrom,
                    validUntil
                })
            )
        };
    },
    options: { customRateLimit: { requests: 200, windowMs: 60000 } }
});
