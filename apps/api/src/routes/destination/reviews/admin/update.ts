/**
 * Admin update destination review endpoint
 * Allows admins to update any destination review
 */
import {
    DestinationReviewIdSchema,
    DestinationReviewSchema,
    type DestinationReviewUpdateInput,
    DestinationReviewUpdateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/destination-reviews/:id
 * Update destination review - Admin endpoint
 */
export const adminUpdateDestinationReviewRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update destination review (admin)',
    description: 'Updates any destination review. Admin only.',
    tags: ['Destinations', 'Reviews'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_UPDATE],
    requestParams: {
        id: DestinationReviewIdSchema
    },
    requestBody: DestinationReviewUpdateInputSchema,
    responseSchema: DestinationReviewSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as DestinationReviewUpdateInput;

        const result = await destinationReviewService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
