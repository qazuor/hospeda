/**
 * Public endpoint to get accommodations by feature
 * Returns paginated list of accommodations that have a specific feature
 */
import { AccommodationPublicSchema, BaseHttpSearchSchema, FeatureIdSchema } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
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

        // SPEC-187 / SPEC-212 data-level omission. The service returns FULL accommodation
        // entities (`findAllWithRelations({ accommodation: true })` has no column
        // allowlist), and `AccommodationPublicSchema` deliberately re-exposes both
        // rich-description fields, so `stripWithSchema` does NOT hide them. Without this
        // the premium markdown rode a card listing.
        const accommodations = (result.data.accommodations ?? []).map(stripRichDescriptionFields);

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
