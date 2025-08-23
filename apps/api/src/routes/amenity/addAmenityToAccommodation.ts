import { z } from '@hono/zod-openapi';
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
        accommodationId: z.string().uuid()
    },
    requestBody: z.object({
        amenityId: z.string().uuid(),
        isOptional: z.boolean().optional(),
        additionalCost: z.object({ amount: z.number(), currency: z.string() }).optional(),
        additionalCostPercent: z.number().min(0).max(100).optional()
    }),
    // TODO [84dc893e-c95e-42d3-810a-91b9e8f7bda9]: Replace with a proper relation schema when available
    responseSchema: z.object({ relation: z.object({ amenityId: z.string().uuid() }).partial() }),
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = body as {
            amenityId: string;
            isOptional?: boolean;
            additionalCost?: { amount: number; currency: string };
            additionalCostPercent?: number;
        };
        const payload = {
            accommodationId: params.accommodationId as string,
            amenityId: parsed.amenityId,
            isOptional: parsed.isOptional,
            additionalCost: parsed.additionalCost,
            additionalCostPercent: parsed.additionalCostPercent
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.addAmenityToAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return { relation: result.data.relation };
    }
});
