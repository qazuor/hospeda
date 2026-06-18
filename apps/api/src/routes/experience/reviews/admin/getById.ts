/**
 * Admin get experience review by ID endpoint.
 * Returns full review information including moderation fields.
 */
import { ExperienceReviewSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const experienceReviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences/reviews/:id
 * Get experience review by ID — Admin endpoint.
 *
 * Requires COMMERCE_MODERATE_REVIEW permission.
 */
export const adminGetExperienceReviewByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get experience review by ID (admin)',
    description:
        'Retrieves full experience review information including moderation fields. Requires COMMERCE_MODERATE_REVIEW.',
    tags: ['Experience Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceReviewSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceReviewService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    }
});
