/**
 * DELETE /api/v1/admin/accommodations/:id/faqs/:faqId
 * Remove an existing FAQ from an accommodation - Admin endpoint
 */

import {
    AccommodationFaqIdSchema,
    AccommodationIdSchema,
    DeleteResultSchema,
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
 * DELETE /api/v1/admin/accommodations/:id/faqs/:faqId
 * Remove FAQ from accommodation - Admin endpoint
 */
export const adminRemoveFaqRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from accommodation (admin)',
    description: 'Remove an FAQ from a specific accommodation. Admin only.',
    tags: ['Accommodations', 'FAQs'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
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
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            data: result.data
        };
    }
});
