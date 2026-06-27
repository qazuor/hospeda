/**
 * Admin get gastronomy review by ID endpoint.
 * Returns full review information including moderation fields.
 */
import { GastronomyReviewSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const gastronomyReviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/gastronomies/reviews/:id
 * Get gastronomy review by ID — Admin endpoint.
 *
 * Requires COMMERCE_MODERATE_REVIEW permission.
 */
export const adminGetGastronomyReviewByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy review by ID (admin)',
    description:
        'Retrieves full gastronomy review information including moderation fields. Requires COMMERCE_MODERATE_REVIEW.',
    tags: ['Gastronomy Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyReviewSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyReviewService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    }
});
