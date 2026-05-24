/**
 * PUT /api/v1/admin/accommodations/:id/faqs/:faqId
 * Update an existing FAQ for an accommodation - Admin endpoint
 */

import {
    AccommodationFaqIdSchema,
    AccommodationFaqSingleOutputSchema,
    type AccommodationFaqUpdateInput,
    AccommodationIdSchema,
    FaqUpdatePayloadSchema,
    type FaqUpdatePayloadType
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/accommodations/:id/faqs/:faqId
 * Update FAQ in accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14 extension): service layer
 * `accommodationService.updateFaq` calls `_canUpdate(actor, accommodation)`
 * which enforces UPDATE_ANY or (UPDATE_OWN + ownership). Route only
 * requires admin-panel access.
 */
export const adminUpdateFaqRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ in accommodation (admin)',
    description:
        'Update an existing FAQ in an accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema,
        faqId: AccommodationFaqIdSchema
    },
    requestBody: FaqUpdatePayloadSchema,
    responseSchema: AccommodationFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: AccommodationFaqUpdateInput = {
            accommodationId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqUpdatePayloadType
        };

        const result = await accommodationService.updateFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
