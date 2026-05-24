/**
 * DELETE /api/v1/admin/accommodations/:id/faqs/:faqId
 * Remove an existing FAQ from an accommodation - Admin endpoint
 */

import { AccommodationFaqIdSchema, AccommodationIdSchema, DeleteResultSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodations/:id/faqs/:faqId
 * Remove FAQ from accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14 extension): service layer
 * `accommodationService.removeFaq` calls `_canUpdate(actor, accommodation)`
 * which enforces UPDATE_ANY or (UPDATE_OWN + ownership). Route only
 * requires admin-panel access.
 */
export const adminRemoveFaqRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from accommodation (admin)',
    description:
        'Remove a FAQ from an accommodation. Requires admin-panel access; the service layer enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema,
        faqId: AccommodationFaqIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.removeFaq(actor, {
            accommodationId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    }
});
