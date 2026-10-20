/**
 * Public endpoint to get accommodations by feature
 * Returns paginated list of accommodations that have a specific feature
 */
import { AccommodationPublicSchema, BaseHttpSearchSchema, FeatureIdSchema } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import {
    filterPublicPaidFieldsForOwner,
    resolvePublicFieldGrants
} from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const featureService = new FeatureService({ logger: apiLogger });

/**
 * GET /api/v1/public/features/:id/accommodations
 * Get accommodations by feature - Public endpoint
 */
export const publicGetAccommodationsByFeatureRoute = createPublicListRoute({
    method: 'get',
    path: '/{featureId}/accommodations',
    summary: 'Get accommodations by feature',
    description: 'Returns a list of accommodations that include a specific feature',
    tags: ['Features', 'Accommodations'],
    requestParams: { featureId: FeatureIdSchema },
    responseSchema: AccommodationPublicSchema,
    requestQuery: BaseHttpSearchSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await featureService.getAccommodationsByFeature(actor, {
            featureId: params.featureId as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        // The service returns full accommodation entities; filter paid fields using
        // each row owner's effective capabilities before response serialization.
        const rawAccommodations = result.data.accommodations ?? [];
        const grants = await resolvePublicFieldGrants(
            rawAccommodations.map((item) => item.ownerId)
        );
        const strippedAccommodations = rawAccommodations.map((item) =>
            filterPublicPaidFieldsForOwner(item, grants)
        );

        const accommodations = strippedAccommodations;

        const { page, pageSize } = extractPaginationParams(query || {});
        return {
            items: accommodations,
            pagination: getPaginationResponse(accommodations.length, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
