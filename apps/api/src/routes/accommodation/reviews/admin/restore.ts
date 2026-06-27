/**
 * Admin restore accommodation review endpoint
 * Restores a soft-deleted accommodation review
 */
import {
    AccommodationReviewAdminSchema,
    AccommodationReviewIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodation-reviews/:id/restore
 * Restore accommodation review - Admin endpoint
 */
export const adminRestoreAccommodationReviewRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore accommodation review',
    description:
        'Restores a soft-deleted accommodation review. Requires ACCOMMODATION_REVIEW_RESTORE permission.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_RESTORE],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    responseSchema: AccommodationReviewAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await accommodationReviewService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await accommodationReviewService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
