import {
    AccommodationIdSchema,
    FeatureIdSchema,
    RemovalResultSchema,
    type RemoveFeatureFromAccommodationInput
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const removeFeatureFromAccommodationRoute = createCRUDRoute({
    method: 'delete',
    path: '/accommodations/{accommodationId}/features/{featureId}',
    summary: 'Remove feature from accommodation',
    description: 'Removes a relation between a feature and an accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: AccommodationIdSchema, featureId: FeatureIdSchema },
    responseSchema: RemovalResultSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const payload: RemoveFeatureFromAccommodationInput = {
            accommodationId: params.accommodationId as string,
            featureId: params.featureId as string
        };
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.removeFeatureFromAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
