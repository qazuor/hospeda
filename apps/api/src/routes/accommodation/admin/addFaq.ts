/**
 * POST /api/v1/admin/accommodations/:id/faqs
 * Add a new FAQ to an accommodation - Admin endpoint
 */

import {
    type AccommodationFaqAddInput,
    AccommodationFaqSingleOutputSchema,
    AccommodationIdSchema,
    FaqCreatePayloadSchema,
    type FaqCreatePayloadType,
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
 * POST /api/v1/admin/accommodations/:id/faqs
 * Add FAQ to accommodation - Admin endpoint
 */
export const adminAddFaqRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to accommodation (admin)',
    description: 'Add a new frequently asked question to a specific accommodation. Admin only.',
    tags: ['Accommodations', 'FAQs'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
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
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
