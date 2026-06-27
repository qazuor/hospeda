/**
 * Admin soft delete gastronomy review endpoint.
 * Allows admins to soft-delete any gastronomy review.
 */
import { DeleteResultSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const gastronomyReviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/gastronomies/reviews/:id
 * Soft delete gastronomy review — Admin endpoint.
 *
 * Requires COMMERCE_MODERATE_REVIEW permission. The service layer
 * (`_canSoftDelete`) also accepts the review author.
 */
export const adminDeleteGastronomyReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete gastronomy review (admin)',
    description: 'Soft deletes a gastronomy review. Requires COMMERCE_MODERATE_REVIEW permission.',
    tags: ['Gastronomy Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await gastronomyReviewService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
