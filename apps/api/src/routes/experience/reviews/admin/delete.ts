/**
 * Admin soft delete experience review endpoint.
 * Allows admins to soft-delete any experience review.
 */
import { DeleteResultSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const experienceReviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/experiences/reviews/:id
 * Soft delete experience review — Admin endpoint.
 *
 * Requires COMMERCE_MODERATE_REVIEW permission. The service layer
 * (`_canSoftDelete`) also accepts the review author.
 */
export const adminDeleteExperienceReviewRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete experience review (admin)',
    description: 'Soft deletes an experience review. Requires COMMERCE_MODERATE_REVIEW permission.',
    tags: ['Experience Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await experienceReviewService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
