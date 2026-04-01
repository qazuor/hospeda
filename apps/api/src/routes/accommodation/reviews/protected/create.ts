/**
 * Protected create accommodation review endpoint
 * Requires authentication
 */
import type { z } from '@hono/zod-openapi';
import {
    AccommodationIdSchema,
    AccommodationReviewCreateInputSchema,
    AccommodationReviewProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/protected/accommodations/:accommodationId/reviews
 * Create accommodation review - Protected endpoint
 */
export const protectedCreateAccommodationReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{accommodationId}/reviews',
    summary: 'Create accommodation review',
    description:
        'Creates a new review for a specific accommodation. Requires ACCOMMODATION_REVIEW_CREATE permission.',
    tags: ['Accommodation Reviews'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE],
    requestParams: {
        accommodationId: AccommodationIdSchema
    },
    requestBody: AccommodationReviewCreateInputSchema,
    responseSchema: AccommodationReviewProtectedSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof AccommodationReviewCreateInputSchema>;
        const payload = {
            ...input,
            accommodationId: params.accommodationId as z.infer<typeof AccommodationIdSchema>,
            userId: actor.id
        };
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});
