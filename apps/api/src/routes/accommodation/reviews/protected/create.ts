/**
 * Protected create accommodation review endpoint
 * Requires authentication
 */
import type { z } from '@hono/zod-openapi';
import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    AccommodationReviewCreateBodySchema,
    AccommodationReviewProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../../middlewares/entitlement';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/protected/accommodations/:accommodationId/reviews
 * Create accommodation review - Protected endpoint.
 *
 * The route validates ONLY the review payload (rating + optional title +
 * optional content). `accommodationId` and `userId` are supplied by the
 * URL path and the authenticated actor respectively, so the client never
 * needs to echo them in the body.
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
    requestBody: AccommodationReviewCreateBodySchema,
    responseSchema: AccommodationReviewProtectedSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof AccommodationReviewCreateBodySchema>;
        const payload = {
            ...input,
            accommodationId: params.accommodationId as z.infer<typeof AccommodationIdSchema>,
            userId: actor.id
        };
        const service = new AccommodationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        // SPEC-145 T-005 / SPEC-216: WRITE_REVIEWS gate — granted on all tourist
        // plans (tourist-free, tourist-plus, tourist-vip) and on all owner/complex
        // plans (via tourist-VIP entitlement inheritance, SPEC-216). Free tourists
        // and owners can write reviews; unauthenticated access is blocked upstream.
        middlewares: [requireEntitlement(EntitlementKey.WRITE_REVIEWS)]
    }
});
