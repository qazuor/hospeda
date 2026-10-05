/**
 * GET /api/v1/public/accommodations/by-destination
 * Get accommodations filtered by destination
 */

import { AccommodationPublicSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { resolvePublicIsFeatured } from '../../../utils/accommodation-featured';
import { createGuestActor } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting accommodations by destination
 * Simplified handler that focuses on business logic
 *
 * @param c - Hono context
 * @returns Accommodations list data
 */
const getByDestinationHandler = async (c: Context) => {
    const { destinationId } = c.req.param();

    // Create guest actor for public endpoint
    const actor = createGuestActor();

    // Validate required parameters
    if (!destinationId) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'destination ID is required');
    }

    // Get accommodations by destination
    const result = await accommodationService.getByDestination(actor, {
        destinationId,
        page: 1,
        pageSize: 20
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // SPEC-187 / SPEC-212 data-level omission: richDescription and its i18n
    // sibling are PREMIUM fields gated per-owner by the entitlement system. This
    // card-listing endpoint never renders them, so BOTH are stripped here before
    // reaching the response payload — fail-closed and independent of any schema
    // change.
    const data = result.data ?? { accommodations: [] };
    const strippedAccommodations = Array.isArray(data.accommodations)
        ? data.accommodations.map((accommodation) => ({
              ...stripRichDescriptionFields(accommodation),
              // HOS-929: public read treats holding either the admin-curated
              // `isFeatured` flag OR the billing-derived `featuredByEntitlement`
              // flag as featured. `featuredByEntitlement` itself is stripped by
              // `AccommodationPublicSchema` (never in its pick).
              isFeatured: resolvePublicIsFeatured(accommodation)
          }))
        : [];

    // The SPEC-291 isVerified owner-entitlement gate was removed with the
    // legacy billing system (HOS-1416); `isVerified` is emitted as stored.
    const accommodations = strippedAccommodations;

    return { accommodations };
};

/**
 * Route definition using createSimpleRoute factory
 * ✅ 80% less boilerplate than manual createRoute
 */
export const getByDestinationRoute = createPublicRoute({
    method: 'get',
    path: '/destination/{destinationId}',
    summary: 'Get accommodations by destination',
    description: 'Retrieve all accommodations for a specific destination',
    tags: ['Accommodations'],
    requestParams: { destinationId: z.string().uuid() },
    responseSchema: z.object({ accommodations: z.array(AccommodationPublicSchema) }),
    handler: async (c: Context) => getByDestinationHandler(c)
});

// Export handler for use in route registration (compatibility)
export { getByDestinationHandler };
