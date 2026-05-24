/**
 * POST /api/v1/admin/accommodations/:id/faqs
 * Add a new FAQ to an accommodation - Admin endpoint
 */

import {
    type AccommodationFaqAddInput,
    AccommodationFaqSingleOutputSchema,
    AccommodationIdSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/faqs
 * Add FAQ to accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14 extension): service layer
 * `accommodationService.addFaq` calls `_canUpdate(actor, accommodation)`
 * which enforces `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN`
 * + ownership). Route only requires admin-panel access so HOSTs can
 * manage FAQs on their own accommodations.
 */
export const adminAddFaqRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to accommodation (admin)',
    description:
        'Add a new frequently asked question to an accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqCreatePayloadSchema,
    responseSchema: AccommodationFaqSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: AccommodationFaqAddInput = {
            accommodationId: params.id as string,
            faq: body as FaqCreatePayloadType
        };

        const result = await accommodationService.addFaq(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
