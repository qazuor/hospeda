/**
 * Admin soft delete accommodation review endpoint
 * Allows admins to soft delete any accommodation review
 */
import {
    AccommodationReviewIdSchema,
    DeleteResultSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodation-reviews/:id
 * Soft delete accommodation review - Admin endpoint
 */
export const adminDeleteAccommodationReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete accommodation review (admin)',
    description:
        'Soft deletes an accommodation review. Requires ACCOMMODATION_REVIEW_DELETE permission.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_DELETE],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await accommodationReviewService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
