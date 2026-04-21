/**
 * Admin update accommodation review endpoint
 * Allows admins to update any accommodation review
 */
import type { z } from '@hono/zod-openapi';
import {
    AccommodationReviewAdminSchema,
    AccommodationReviewIdSchema,
    AccommodationReviewUpdateInputSchema,
    PermissionEnum
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
        'Updates an accommodation review. Requires both ACCOMMODATION_REVIEW_UPDATE and ACCOMMODATION_REVIEW_MODERATE — reviews are moderated content (T-026 / GAP-036).',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
    ],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    requestBody: AccommodationReviewUpdateInputSchema,
    responseSchema: AccommodationReviewAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof AccommodationReviewUpdateInputSchema>;
        const result = await accommodationReviewService.update(actor, params.id as string, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
