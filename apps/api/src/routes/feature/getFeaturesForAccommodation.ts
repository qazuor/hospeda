import { AccommodationIdSchema, BaseHttpSearchSchema, FeatureListItemSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const getFeaturesForAccommodationRoute = createListRoute({
    method: 'get',
    path: '/accommodations/{accommodationId}/features',
    summary: 'Get features for an accommodation',
    description: 'Returns a list of features associated to a given accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: AccommodationIdSchema },
    responseSchema: FeatureListItemSchema,
    requestQuery: BaseHttpSearchSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await service.getFeaturesForAccommodation(actor, {
            accommodationId: params.accommodationId as string
        });

        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data.features,
            pagination: getPaginationResponse(result.data.features.length, { page, pageSize })
        };
    }
});
