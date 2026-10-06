/**
 * Protected create accommodation review endpoint
 * Requires authentication
 */

import {
    AccommodationIdSchema,
    AccommodationReviewCreateBodySchema,
    AccommodationReviewProtectedSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { createSlidingWindowPerUserRateLimit } from '../../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';
import type { z } from '../../../../utils/zod';

/** Stricter per-user write budget: 30 review submissions per hour. */
const writeReviewRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: 3_600_000,
    max: 30,
    keyPrefix: 'prot:write:review'
});

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
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed WRITE_REVIEWS entitlement gate.
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
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
        middlewares: [writeReviewRateLimit]
    }
});
