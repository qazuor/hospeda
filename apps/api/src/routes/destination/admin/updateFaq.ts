/**
 * PUT /api/v1/admin/destinations/:id/faqs/:faqId
 * Update an existing FAQ for a destination - Admin endpoint
 */

import {
    DestinationFaqIdSchema,
    DestinationFaqSingleOutputSchema,
    type DestinationFaqUpdateInput,
    DestinationIdSchema,
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/destinations/:id/faqs/:faqId
 * Update FAQ in destination - Admin endpoint
 *
 * Permission model (SPEC-177): service layer `destinationService.updateFaq` calls
 * `_canUpdate(actor, destination)` which enforces UPDATE_ANY or (UPDATE_OWN + ownership).
 * Route only requires admin-panel access.
 */
export const adminUpdateDestinationFaqRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in destination (admin)',
    description:
        'Update an existing FAQ in a destination. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Destinations', 'FAQs'],
    requestParams: {
        id: DestinationIdSchema,
        faqId: DestinationFaqIdSchema
    },
    requestBody: FaqUpdatePayloadSchema,
    responseSchema: DestinationFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: DestinationFaqUpdateInput = {
            destinationId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqUpdatePayloadType
        };

        const result = await destinationService.updateFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
