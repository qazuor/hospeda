/**
 * GET /api/v1/admin/accommodations/:id/faqs
 * Get all FAQs for an accommodation - Admin endpoint
 */

import {
    AccommodationFaqListOutputSchema,
    AccommodationIdSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/:id/faqs
 * Get accommodation FAQs - Admin endpoint
 */
export const adminGetFaqsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/faqs',
    summary: 'Get accommodation FAQs (admin)',
    description: 'Retrieve all FAQs for an accommodation. Admin only.',
    tags: ['Accommodations', 'FAQs'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationFaqListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getFaqs(actor, {
            accommodationId: params.id as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return { faqs: result.data.faqs || [] };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
