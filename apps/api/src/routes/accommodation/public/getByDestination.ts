/**
 * GET /api/v1/public/accommodations/by-destination
 * Get accommodations filtered by destination
 */

import { AccommodationListWrapperSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * Strips richDescription from an accommodation object before it reaches the
 * public response payload.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * The destination-list endpoint is a card listing that never renders it, so the
 * field must be absent from the payload regardless of the owner's current plan.
 * This omission is applied at the DATA level so it is fail-closed and independent
 * of any Zod schema change. (SPEC-187 data-exposure fix.)
 *
 * @param item - Raw accommodation object from the service layer.
 * @returns The accommodation object with richDescription removed.
 */
function stripRichDescription<T extends { richDescription?: unknown }>(
    item: T
): Omit<T, 'richDescription'> {
    const { richDescription: _dropped, ...rest } = item;
    return rest;
}

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

    // SPEC-187 data-level omission: richDescription is a PREMIUM field gated
    // per-owner by the entitlement system. This card-listing endpoint never
    // renders it, so the field is stripped here before reaching the response
    // payload — fail-closed and independent of any schema change.
    const data = result.data ?? { accommodations: [] };
    const accommodations = Array.isArray(data.accommodations)
        ? data.accommodations.map(stripRichDescription)
        : [];
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
    responseSchema: AccommodationListWrapperSchema,
    handler: async (c: Context) => getByDestinationHandler(c)
});

// Export handler for use in route registration (compatibility)
export { getByDestinationHandler };
