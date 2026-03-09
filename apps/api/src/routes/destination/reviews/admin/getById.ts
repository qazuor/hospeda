/**
 * Admin get destination review by ID endpoint
 * Returns full destination review information
 */
import { DestinationReviewIdSchema, DestinationReviewSchema, PermissionEnum } from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destination-reviews/:id
 * Get destination review by ID - Admin endpoint
 */
export const adminGetDestinationReviewByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get destination review by ID (admin)',
    description: 'Retrieves full destination review information by ID',
    tags: ['Destinations', 'Reviews'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_VIEW],
    requestParams: {
        id: DestinationReviewIdSchema
    },
    responseSchema: DestinationReviewSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationReviewService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
