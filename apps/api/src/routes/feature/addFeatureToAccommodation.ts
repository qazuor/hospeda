import {
    AccommodationFeatureRelationSchema,
    AccommodationIdSchema,
    type AddFeatureToAccommodationInput,
    AddFeatureToAccommodationInputSchema
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const addFeatureToAccommodationRoute = createCRUDRoute({
    method: 'post',
    path: '/accommodations/{accommodationId}/features',
    summary: 'Add feature to accommodation',
    description: 'Creates a relation between a feature and an accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: AccommodationIdSchema },
    requestBody: AddFeatureToAccommodationInputSchema.omit({ accommodationId: true }),
    responseSchema: AccommodationFeatureRelationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = body as Omit<AddFeatureToAccommodationInput, 'accommodationId'>;
        const payload: AddFeatureToAccommodationInput = {
            accommodationId: params.accommodationId as string,
            featureId: parsed.featureId,
            hostReWriteName: parsed.hostReWriteName,
            comments: parsed.comments
        };
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.addFeatureToAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
