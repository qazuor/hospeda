/**
 * Admin update gastronomy review endpoint.
 * Allows admins to update any gastronomy review.
 */
import {
    GastronomyReviewSchema,
    type GastronomyReviewUpdateInput,
    GastronomyReviewUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const gastronomyReviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/gastronomies/reviews/:id
 * Update gastronomy review — Admin endpoint.
 *
 * Requires both GASTRONOMY_EDIT_ALL and GASTRONOMY_MODERATE_REVIEW (or, until
 * HOS-1077 release 2, their legacy COMMERCE_ equivalents) — reviews are
 * moderated content (mirrors accommodation review update pattern).
 */
export const adminUpdateGastronomyReviewRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update gastronomy review (admin)',
    description:
        'Updates a gastronomy review. Requires GASTRONOMY_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL) AND GASTRONOMY_MODERATE_REVIEW (or the legacy COMMERCE_MODERATE_REVIEW).',
    tags: ['Gastronomy Reviews', 'Admin'],
    anyOfPermissions: [
        [PermissionEnum.GASTRONOMY_EDIT_ALL, PermissionEnum.COMMERCE_EDIT_ALL],
        [PermissionEnum.GASTRONOMY_MODERATE_REVIEW, PermissionEnum.COMMERCE_MODERATE_REVIEW]
    ],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyReviewUpdateInputSchema,
    responseSchema: GastronomyReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as GastronomyReviewUpdateInput;
        const result = await gastronomyReviewService.update(actor, params.id as string, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
