/**
 * Admin update accommodation review endpoint
 * Allows admins to update any accommodation review
 */
import type { z } from '@hono/zod-openapi';
import {
    AccommodationReviewIdSchema,
    AccommodationReviewSchema,
    AccommodationReviewUpdateInputSchema,
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
 * PUT /api/v1/admin/accommodation-reviews/:id
 * Update accommodation review - Admin endpoint
 */
export const adminUpdateAccommodationReviewRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update accommodation review (admin)',
    description:
        'Updates an accommodation review. Requires ACCOMMODATION_REVIEW_UPDATE permission.',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_UPDATE],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    requestBody: AccommodationReviewUpdateInputSchema,
    responseSchema: AccommodationReviewSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof AccommodationReviewUpdateInputSchema>;
        const result = await accommodationReviewService.update(actor, params.id as string, input);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
