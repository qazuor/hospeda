/**
 * Admin update experience review endpoint.
 * Allows admins to update any experience review.
 */
import {
    ExperienceReviewSchema,
    type ExperienceReviewUpdateInput,
    ExperienceReviewUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const experienceReviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/experiences/reviews/:id
 * Update experience review — Admin endpoint.
 *
 * Requires both EXPERIENCE_EDIT_ALL and EXPERIENCE_MODERATE_REVIEW (or, until
 * HOS-1077 release 2, their legacy COMMERCE_ equivalents) — reviews are
 * moderated content (mirrors accommodation review update pattern).
 */
export const adminUpdateExperienceReviewRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update experience review (admin)',
    description:
        'Updates an experience review. Requires EXPERIENCE_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL) AND EXPERIENCE_MODERATE_REVIEW (or the legacy COMMERCE_MODERATE_REVIEW).',
    tags: ['Experience Reviews', 'Admin'],
    anyOfPermissions: [
        [PermissionEnum.EXPERIENCE_EDIT_ALL, PermissionEnum.COMMERCE_EDIT_ALL],
        [PermissionEnum.EXPERIENCE_MODERATE_REVIEW, PermissionEnum.COMMERCE_MODERATE_REVIEW]
    ],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceReviewUpdateInputSchema,
    responseSchema: ExperienceReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as ExperienceReviewUpdateInput;
        const result = await experienceReviewService.update(actor, params.id as string, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
