/**
 * Protected create destination review endpoint
 * Requires authentication
 */
import type { z } from '@hono/zod-openapi';
import {
    DestinationIdSchema,
    DestinationReviewCreateInputSchema,
    DestinationReviewSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/protected/destinations/:destinationId/reviews
 * Create destination review - Protected endpoint
 */
export const protectedCreateDestinationReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{destinationId}/reviews',
    summary: 'Create destination review',
    description:
        'Creates a new review for a specific destination. Requires DESTINATION_REVIEW_CREATE permission.',
    tags: ['Destinations', 'Reviews'],
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_CREATE],
    requestParams: {
        destinationId: DestinationIdSchema
    },
    requestBody: DestinationReviewCreateInputSchema,
    responseSchema: DestinationReviewSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof DestinationReviewCreateInputSchema>;
        const payload = {
            ...input,
            destinationId: params.destinationId as z.infer<typeof DestinationIdSchema>
        };
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return result.data;
    }
});
