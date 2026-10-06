/**
 * PUT /api/v1/protected/accommodations/:id/faqs/:faqId
 * Update an existing FAQ for an accommodation
 */

import {
    AccommodationFaqIdSchema,
    AccommodationFaqSingleOutputSchema,
    type AccommodationFaqUpdateInput,
    AccommodationIdSchema,
    FaqWithChannelVisibilityUpdatePayloadSchema,
    type FaqWithChannelVisibilityUpdatePayloadType
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

// Initialize service once
const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Route definition using createCRUDRoute factory
 */
export const updateFaqRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in accommodation',
    description: 'Update an existing FAQ in a specific accommodation',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema,
        faqId: AccommodationFaqIdSchema
    },
    requestBody: FaqWithChannelVisibilityUpdatePayloadSchema,
    responseSchema: AccommodationFaqSingleOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_ACCOMMODATION_INFO entitlement gate.
    handler: async (c: Context, params, body) => {
        // Get actor from context (authenticated user for protected endpoint)
        const actor = getActorFromContext(c);

        // Combine path params with body to form the service input
        const input: AccommodationFaqUpdateInput = {
            accommodationId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqWithChannelVisibilityUpdatePayloadType
        };

        // Update FAQ for accommodation
        const result = await accommodationService.updateFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});

// Export handler for compatibility (not needed with createCRUDRoute)
export const updateFaqHandler = null;
