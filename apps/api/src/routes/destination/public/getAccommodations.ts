/**
 * Public destination accommodations endpoint
 * Returns accommodations for a specific destination
 */
import { AccommodationPublicSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveOwnerEntitlementsForOwnerIds } from '../../../middlewares/owner-entitlement';
import { getActorFromContext } from '../../../utils/actor';
import type { AccommodationData } from '../../../utils/entitlement-filter';
import {
    filterAccommodationListByOwnerEntitlements,
    stripRichDescriptionFields
} from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/public/destinations/:id/accommodations
 * Get destination accommodations - Public endpoint
 */
export const publicGetDestinationAccommodationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'Get destination accommodations',
    description: 'Retrieves all accommodations for a specific destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.array(AccommodationPublicSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getAccommodations(actor, {
            destinationId: params.id as string,
            page: 1,
            pageSize: 100
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        // Service wraps the value as { accommodations: [...] }; the responseSchema
        // is the bare array, so unwrap before returning. Strip BOTH premium
        // rich-description fields — this is a public card listing (SPEC-187), and
        // the SPEC-212 i18n sibling must never be gated separately from the plain
        // field. The static `AccommodationListItem` type declares neither, but the
        // underlying `findAll` runs `SELECT *`, so both are present at runtime.
        const strippedAccommodations = (result.data?.accommodations ?? []).map((a) =>
            stripRichDescriptionFields(a)
        );

        // SPEC-291 Phase 3b / HOS-341: gate `isVerified` by the OWNER's billing
        // entitlement. ONE batch query for every unique ownerId on this page, then a
        // synchronous gate pass. Fail-closed: an owner absent from the map keeps no
        // badge.
        //
        // The gate depends on the owner of the row, never on the reader — which is
        // what makes it safe here. `/api/v1/public/destinations` is a shared-cached
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

        return filterAccommodationListByOwnerEntitlements(
            strippedAccommodations as AccommodationData[],
            ownerEntitlementsMap
        );
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
