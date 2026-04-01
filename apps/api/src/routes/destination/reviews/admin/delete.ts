/**
 * Admin soft delete destination review endpoint
 * Allows admins to soft delete any destination review
 */
import { DeleteResultSchema, DestinationReviewIdSchema, PermissionEnum } from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/destination-reviews/:id
 * Soft delete destination review - Admin endpoint
 */
export const adminDeleteDestinationReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete destination review (admin)',
    description: 'Soft deletes a destination review. Admin only.',
    tags: ['Destination Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_DELETE],
    requestParams: {
        id: DestinationReviewIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await destinationReviewService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
