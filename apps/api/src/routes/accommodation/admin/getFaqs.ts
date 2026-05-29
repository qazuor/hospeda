/**
 * GET /api/v1/admin/accommodations/:id/faqs
 * Get all FAQs for an accommodation - Admin endpoint
 */

import { AccommodationFaqListOutputSchema, AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/:id/faqs
 * Get accommodation FAQs - Admin endpoint.
 *
 * SPEC-169 §2.1: the gate only requires admin access; ownership is enforced in the service via
 * `adminGetFaqs` → `checkCanAdminView` (a VIEW_OWN host sees only their own accommodation's FAQs;
 * others, including PUBLIC, resolve to NOT_FOUND). Uses `adminGetFaqs`, NOT the generic `getFaqs`
 * (whose `_canView` allows any viewable accommodation and is reserved for the protected/public path).
 */
export const adminGetFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get accommodation FAQs (admin)',
    description: 'Retrieve all FAQs for an accommodation. Admin only.',
    tags: ['Accommodations', 'FAQs'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.adminGetFaqs(actor, {
            accommodationId: params.id as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { faqs: result.data.faqs || [] };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
