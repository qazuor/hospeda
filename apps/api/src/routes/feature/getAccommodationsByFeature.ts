import { AccommodationListItemSchema, BaseHttpSearchSchema, FeatureIdSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const getAccommodationsByFeatureRoute = createListRoute({
    method: 'get',
    path: '/features/{featureId}/accommodations',
    summary: 'Get accommodations by feature',
    description: 'Returns a list of accommodations that include a specific feature',
    tags: ['Features', 'Accommodations'],
    requestParams: { featureId: FeatureIdSchema },
    responseSchema: AccommodationListItemSchema,
    requestQuery: BaseHttpSearchSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.getAccommodationsByFeature(actor, {
            featureId: params.featureId as string
        });
        if (result.error) throw new Error(result.error.message);
        const { page, pageSize } = extractPaginationParams(query || {});
        return {
            items: result.data.accommodations,
            pagination: getPaginationResponse(result.data.accommodations.length, { page, pageSize })
        };
    }
});
