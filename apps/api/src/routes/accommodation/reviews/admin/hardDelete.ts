/**
 * Admin hard delete accommodation review endpoint
 * Permanently deletes an accommodation review
 */
import { AccommodationReviewIdSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodation-reviews/:id/hard
 * Hard delete accommodation review - Admin endpoint
 */
export const adminHardDeleteAccommodationReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete accommodation review',
    description:
        'Permanently deletes an accommodation review. Requires ACCOMMODATION_REVIEW_HARD_DELETE permission.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_HARD_DELETE],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationReviewService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Accommodation review permanently deleted'
        };
    }
});
