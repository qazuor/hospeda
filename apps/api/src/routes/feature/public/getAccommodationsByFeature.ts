/**
 * Public endpoint to get accommodations by feature
 * Returns paginated list of accommodations that have a specific feature
 */
import { AccommodationPublicSchema, BaseHttpSearchSchema, FeatureIdSchema } from '@repo/schemas';
import { FeatureService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { resolveOwnerEntitlementsForOwnerIds } from '../../../middlewares/owner-entitlement';
import { getActorFromContext } from '../../../utils/actor';
import type { AccommodationData } from '../../../utils/entitlement-filter';
import {
    filterAccommodationListByOwnerEntitlements,
    stripRichDescriptionFields
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

        // SPEC-187 / SPEC-212 data-level omission. The service returns FULL accommodation
        // entities (`findAllWithRelations({ accommodation: true })` has no column
        // allowlist), and `AccommodationPublicSchema` deliberately re-exposes both
        // rich-description fields, so `stripWithSchema` does NOT hide them. Without this
        // the premium markdown rode a card listing.
        const strippedAccommodations = (result.data.accommodations ?? []).map(
            stripRichDescriptionFields
        );

        // SPEC-291 Phase 3b / HOS-341: gate `isVerified` by the OWNER's billing
        // entitlement. ONE batch query for every unique ownerId on this page, then a
        // synchronous gate pass. Fail-closed: an owner absent from the map keeps no
        // badge.
        //
        // The gate depends on the owner of the row, never on the reader — which is
        // what makes it safe here. `/api/v1/public/features` is a shared-cached
        // prefix whose cache key carries no `Authorization`, so any per-viewer check
        // computed in this handler would be served to every later visitor (HOS-288).
        const uniqueOwnerIds = [
            ...new Set(
                strippedAccommodations
                    .map((a) => (a as { ownerId?: string }).ownerId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];
        const ownerEntitlementsMap = await resolveOwnerEntitlementsForOwnerIds(uniqueOwnerIds);
        const accommodations = filterAccommodationListByOwnerEntitlements(
            strippedAccommodations as AccommodationData[],
            ownerEntitlementsMap
        );

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
