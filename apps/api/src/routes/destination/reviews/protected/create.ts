/**
 * Protected create destination review endpoint
 * Requires authentication
 */
import type { z } from '@hono/zod-openapi';
import { EntitlementKey } from '@repo/billing';
import {
    DestinationIdSchema,
    DestinationReviewCreateBodySchema,
    DestinationReviewProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../../middlewares/entitlement';
import { createSlidingWindowPerUserRateLimit } from '../../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/** Stricter per-user write budget: 30 review submissions per hour. */
const writeReviewRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: 3_600_000,
    max: 30,
    keyPrefix: 'prot:write:review'
});

/**
 * POST /api/v1/protected/destinations/:destinationId/reviews
 * Create destination review - Protected endpoint.
 *
 * The route validates ONLY the review payload (rating + optional title +
 * optional content). `destinationId` and `userId` are supplied by the
 * URL path and the authenticated actor respectively, so the client never
 * needs to echo them in the body.
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
    requestBody: DestinationReviewCreateBodySchema,
    responseSchema: DestinationReviewProtectedSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof DestinationReviewCreateBodySchema>;
        const payload = {
            ...input,
            destinationId: params.destinationId as z.infer<typeof DestinationIdSchema>,
            userId: actor.id
        };
        const service = new DestinationReviewService({ logger: apiLogger });
        const result = await service.create(actor, payload);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        // writeReviewRateLimit runs first (fast in-memory check, no DB hit) before
        // requireEntitlement (which does a DB lookup for the user's plan tier).
        // SPEC-145 T-005 / SPEC-216: WRITE_REVIEWS gate — granted on all tourist
        // plans (tourist-free, tourist-plus, tourist-vip) and on all owner/complex
        // plans via tourist-VIP entitlement inheritance (SPEC-216). Same gate as
        // accommodation reviews.
        middlewares: [writeReviewRateLimit, requireEntitlement(EntitlementKey.WRITE_REVIEWS)]
    }
});
