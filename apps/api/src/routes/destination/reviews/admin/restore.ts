/**
 * Admin restore destination review endpoint
 * Restores a soft-deleted destination review - Admin only
 */
import { DestinationReviewIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/destination-reviews/:id/restore
 * Restore destination review - Admin endpoint
 */
export const adminRestoreDestinationReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore destination review',
    description: 'Restores a soft-deleted destination review. Admin only.',
    tags: ['Destinations', 'Reviews'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_RESTORE],
    requestParams: { id: DestinationReviewIdSchema },
    responseSchema: DestinationReviewIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationReviewService.restore(actor, id);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return { id };
    }
});
