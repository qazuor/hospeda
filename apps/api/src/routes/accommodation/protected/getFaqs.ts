/**
 * GET /api/v1/protected/accommodations/:id/faqs
 * Get all FAQs for an accommodation
 */

import { AccommodationFaqListOutputSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Handler for getting all FAQs for an accommodation
 * Simplified handler that focuses on business logic
 *
 * @param c - Hono context
 * @returns FAQs list data
 */
const getFaqsHandler = async (c: Context) => {
    const { id } = c.req.param();

    // HOS-786: this route lives under `/protected/`, so the actor MUST come from
    // the authenticated session. It previously fabricated a guest actor (copied
    // from the public route), which made `_canView` reject every DRAFT/PRIVATE
    // accommodation with NOT_FOUND — the owner's own FAQs read back as an empty
    // list no matter which session cookie was forwarded.
    const actor = getActorFromContext(c);

    // Validate required parameters
    if (!id) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'accommodation ID is required');
    }

    // Get FAQs for accommodation
    const result = await accommodationService.getFaqs(actor, {
        accommodationId: id
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return {
        faqs: result.data.faqs || []
    };
};

/**
 * Route definition using createSimpleRoute factory
 * ✅ 80% less boilerplate than manual createRoute
 */
export const getFaqsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get accommodation FAQs',
    description: 'Retrieve all frequently asked questions for a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: { id: z.string().uuid() },
    responseSchema: AccommodationFaqListOutputSchema,
    handler: async (c: Context) => getFaqsHandler(c)
});

// Export handler for use in route registration (compatibility)
export { getFaqsHandler };
