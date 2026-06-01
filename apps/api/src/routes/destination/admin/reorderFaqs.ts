/**
 * PATCH /api/v1/admin/destinations/:id/faqs/reorder
 * Reorder FAQs for a destination - Admin endpoint
 */

import {
    DestinationIdSchema,
    type FaqReorderPayload,
    FaqReorderPayloadSchema,
    SuccessSchema
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/destinations/:id/faqs/reorder
 * Reorder FAQs for a destination - Admin endpoint
 *
 * Permission model (SPEC-177): service layer `destinationService.reorderFaqs` calls
 * `_canUpdate(actor, destination)` which enforces UPDATE_ANY or (UPDATE_OWN + ownership).
 * Validates that all supplied faqId values belong to the given destination before applying
 * displayOrder updates in a single transaction.
 */
export const adminReorderDestinationFaqsRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/faqs/reorder',
    summary: 'Reorder FAQs for a destination (admin)',
    description:
        'Set the displayOrder for a set of FAQs belonging to a destination. All faqId values must belong to the given destination. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Destinations', 'FAQs'],
    requestParams: {
        id: DestinationIdSchema
    },
    requestBody: FaqReorderPayloadSchema,
    responseSchema: SuccessSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await destinationService.reorderFaqs(actor, {
            destinationId: params.id as string,
            order: (body as FaqReorderPayload).order
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
