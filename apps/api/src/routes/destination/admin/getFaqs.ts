/**
 * GET /api/v1/admin/destinations/:id/faqs
 * Get all FAQs for a destination - Admin endpoint
 */

import { DestinationFaqListOutputSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations/:id/faqs
 * Get destination FAQs - Admin endpoint.
 *
 * SPEC-177: the gate only requires admin access; ownership is enforced in the service via
 * `adminGetFaqs` → `checkCanAdminView` (a VIEW_OWN host sees only their own destination's FAQs;
 * others, including PUBLIC, resolve to NOT_FOUND). Uses `adminGetFaqs`, NOT the generic `getFaqs`
 * (whose `_canView` allows any viewable destination and is reserved for the protected/public path).
 */
export const adminGetDestinationFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get destination FAQs (admin)',
    description: 'Retrieve all FAQs for a destination. Admin only.',
    tags: ['Destinations', 'FAQs'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.adminGetFaqs(actor, {
            destinationId: params.id as string
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
