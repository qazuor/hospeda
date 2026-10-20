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
import {
    filterPublicPaidFieldsForOwner,
    resolvePublicFieldGrants
} from '../../../utils/entitlement-filter';
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

    // Apply owner-effective paid-field grants before the public response is cached.
    const data = result.data ?? { accommodations: [] };
    const pageItems = Array.isArray(data.accommodations) ? data.accommodations : [];
    const grants = await resolvePublicFieldGrants(pageItems.map((item) => item.ownerId));
    const strippedAccommodations = pageItems.map((accommodation) => ({
        ...filterPublicPaidFieldsForOwner(accommodation, grants),
        // HOS-929: the public `isFeatured` is derived from `featuredByEntitlement`
        // (the only featuring source since HOS-1419); the raw column itself is
        // stripped by the public schema (never in its pick).
        isFeatured: resolvePublicIsFeatured(accommodation)
    }));

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
