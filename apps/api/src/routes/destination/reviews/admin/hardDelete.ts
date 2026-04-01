/**
 * Admin hard delete destination review endpoint
 * Permanently deletes a destination review - Admin only
 */
import { DestinationReviewIdSchema, PermissionEnum } from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/destination-reviews/:id/hard
 * Hard delete destination review - Admin endpoint
 */
export const adminHardDeleteDestinationReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete destination review',
    description: 'Permanently deletes a destination review by ID. Admin only.',
    tags: ['Destination Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_HARD_DELETE],
    requestParams: { id: DestinationReviewIdSchema },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationReviewService.hardDelete(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return {
            success: true,
            message: 'Destination review permanently deleted'
        };
    }
});
