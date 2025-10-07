import type { z } from '@hono/zod-openapi';
import {
    AccommodationAmenityRelationSchema,
    AccommodationIdSchema,
    AmenityAddToAccommodationInputSchema,
    type PriceCurrencyEnum
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const addAmenityToAccommodationRoute = createCRUDRoute({
    method: 'post',
    path: '/accommodations/{accommodationId}/amenities',
    summary: 'Add amenity to accommodation',
    description: 'Creates a relation between an amenity and an accommodation',
    tags: ['Amenities', 'Accommodations'],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestBody: AmenityAddToAccommodationInputSchema,
    responseSchema: AccommodationAmenityRelationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = body as z.infer<typeof AmenityAddToAccommodationInputSchema>;
        const payload = {
            accommodationId: params.accommodationId as string,
            amenityId: parsed.amenityId,
            isOptional: parsed.isOptional ?? false,
            additionalCost: parsed.additionalCost
                ? {
                      price: parsed.additionalCost.price,
                      currency: parsed.additionalCost.currency as PriceCurrencyEnum
                  }
                : undefined,
            additionalCostPercent: parsed.additionalCostPercent
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.addAmenityToAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
