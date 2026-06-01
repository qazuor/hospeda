/**
 * PATCH /api/v1/admin/accommodations/:id/faqs/reorder
 * Reorder FAQs for an accommodation - Admin endpoint
 */

import {
    AccommodationIdSchema,
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    SuccessSchema
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/accommodations/:id/faqs/reorder
 * Reorder FAQs for an accommodation - Admin endpoint
 *
 * Permission model (SPEC-177): service layer `accommodationService.reorderFaqs` calls
 * `_canUpdate(actor, accommodation)` which enforces `ACCOMMODATION_UPDATE_ANY` OR
 * (`ACCOMMODATION_UPDATE_OWN` + ownership). Validates that all supplied faqId values
 * belong to the given accommodation before applying displayOrder updates in a single
 * transaction.
 */
export const adminReorderAccommodationFaqsRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs for an accommodation (admin)',
    description:
        'Set the displayOrder for a set of FAQs belonging to an accommodation. All faqId values must belong to the given accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: SuccessSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.reorderFaqs(actor, {
            accommodationId: params.id as string,
            order: (body as FaqReorderPayload).order
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
