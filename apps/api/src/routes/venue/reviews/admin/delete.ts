/**
 * Admin soft delete venue review endpoint.
 * Allows admins to soft-delete any venue review.
 */
import { DeleteResultSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, VenueReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const venueReviewService = new VenueReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/venues/reviews/:id
 * Soft delete venue review — Admin endpoint.
 *
 * Requires VENUE_MODERATE_REVIEW permission. The service layer
 * (`_canSoftDelete`) also accepts the review author.
 */
export const adminDeleteVenueReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete gastronomy review (admin)',
    description: 'Soft deletes a gastronomy review. Requires VENUE_MODERATE_REVIEW permission.',
    tags: ['Gastronomy Reviews', 'Admin'],
    anyOfPermissions: [[PermissionEnum.VENUE_MODERATE_REVIEW]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await venueReviewService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
