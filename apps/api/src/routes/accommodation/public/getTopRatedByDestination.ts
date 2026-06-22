/**
 * GET /api/v1/public/accommodations/top-rated-by-destination
 * Get top-rated accommodations grouped by destination
 */

import { AccommodationPublicSchema, PaginationResultSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Fixed maximum fetch size for the top-rated-by-destination query.
 * Must match the `pageSize` passed to the service call below.
 * Used as `pageSize` in the pagination envelope so that it is always a
 * positive integer, even when the result set is empty (total === 0).
 */
const TOP_RATED_PAGE_SIZE = 10;

/**
 * SPEC-210: Public-tier paginated response schema for top-rated-by-destination.
 *
 * Uses PaginationResultSchema(AccommodationPublicSchema) — re-exported from
 * @repo/schemas — so that internal-only fields (createdById, updatedById,
 * deletedAt, deletedById, adminInfo, moderationState, lastWarnedAt,
 * translationMeta, etc.) are stripped by stripWithSchema at the route layer
 * before serialization.
 */
const topRatedPublicResponseSchema = PaginationResultSchema(AccommodationPublicSchema);

/**
 * Handler for getting top-rated accommodations by destination.
 *
 * The service returns `{ accommodations: Accommodation[] }` (a flat list,
 * not paginated). This handler wraps that array into the paginated envelope
 * expected by the responseSchema so that stripWithSchema does not throw.
 *
 * SPEC-210: response is serialized through AccommodationPublicSchema — internal
 * fields are stripped at the schema layer before the response is sent.
 *
 * @param c - Hono context
 * @returns Paginated envelope `{ data: AccommodationPublic[], pagination: {...} }`
 */
const getTopRatedByDestinationHandler = async (c: Context) => {
    const { destinationId } = c.req.param();

    // Create guest actor for public endpoint
    const actor = createGuestActor();

    if (!destinationId) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'destination ID is required');
    }

    // Get top-rated accommodations by destination (provide required defaults)
    const result = await accommodationService.getTopRatedByDestination(actor, {
        destinationId,
        pageSize: 10
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // The service returns AccommodationListWrapper: { accommodations: Accommodation[] }.
    // Wrap into the paginated envelope so stripWithSchema against
    // topRatedPublicResponseSchema succeeds. This is a fixed-size fetch
    // (pageSize = TOP_RATED_PAGE_SIZE), so pagination reflects a single page.
    //
    // pageSize: always TOP_RATED_PAGE_SIZE (a positive constant) — NEVER `total`.
    //   Using `total` as pageSize breaks the z.number().int().positive() constraint
    //   when the destination has 0 rated accommodations (total === 0), causing
    //   stripWithSchema to throw → HTTP 500. The fixed page size is semantically
    //   correct: it describes the maximum capacity of the page, not the actual count.
    //
    // totalPages: 0 when empty (no pages to show), 1 when non-empty (all results
    //   fit in one page since the service caps at TOP_RATED_PAGE_SIZE items).
    //   z.number().int().min(0) accepts 0, so the empty case is valid.
    const accommodations = result.data?.accommodations ?? [];
    const total = accommodations.length;
    const totalPages = total === 0 ? 0 : 1;

    return {
        data: accommodations,
        pagination: {
            page: 1,
            pageSize: TOP_RATED_PAGE_SIZE,
            total,
            totalPages,
            hasNextPage: false,
            hasPreviousPage: false
        }
    };
};

/**
 * Route definition using createPublicRoute factory.
 *
 * SPEC-210 fixes:
 *   1. responseSchema changed from AccommodationTopRatedOutputSchema
 *      (= PaginationResultSchema(AccommodationSchema), the FULL entity) to
 *      PaginationResultSchema(AccommodationPublicSchema) — prevents leaking
 *      internal-only fields.
 *   2. Handler returns the paginated envelope `{ data, pagination }` with a fixed
 *      positive pageSize constant (TOP_RATED_PAGE_SIZE) — prevents the HTTP 500
 *      that occurred when total === 0 and pageSize: total violated the positive()
 *      constraint during stripWithSchema.
 *   3. PaginationResultSchema is imported from @repo/schemas (SSOT) instead of
 *      being duplicated inline.
 */
export const getTopRatedByDestinationRoute = createPublicRoute({
    method: 'get',
    path: '/destination/{destinationId}/top-rated',
    summary: 'Get top-rated accommodations by destination',
    description: 'Retrieve top-rated accommodations for a specific destination',
    tags: ['Accommodations'],
    requestParams: { destinationId: z.string().uuid() },
    responseSchema: topRatedPublicResponseSchema,
    handler: async (c: Context) => getTopRatedByDestinationHandler(c)
});

// Export handler for use in route registration (compatibility)
export { getTopRatedByDestinationHandler };
