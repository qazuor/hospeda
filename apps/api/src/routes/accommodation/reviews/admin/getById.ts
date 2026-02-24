/**
 * Admin get accommodation review by ID endpoint
 * Returns full review information including admin fields
 */
import {
    AccommodationReviewIdSchema,
    AccommodationReviewSchema,
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
 * GET /api/v1/admin/accommodation-reviews/:id
 * Get accommodation review by ID - Admin endpoint
 */
export const adminGetAccommodationReviewByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation review by ID (admin)',
    description: 'Retrieves full accommodation review information including admin fields',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_VIEW],
    requestParams: {
        id: AccommodationReviewIdSchema
    },
    responseSchema: AccommodationReviewSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationReviewService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
