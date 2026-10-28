/**
 * Protected create venue review endpoint (T-044)
 * A logged-in tourist (or any authenticated user) submits a review for a venue listing.
 *
 * Behavior:
 * - moderationState is forced to PENDING by VenueReviewService._beforeCreate()
 *   (defense-in-depth; any caller-supplied value is silently overridden).
 * - One review per user per listing is enforced (ALREADY_EXISTS on duplicate).
 * - After creation, the listing's denormalized rating fields are recomputed.
 */

import { VenueReviewCreateInputSchema, VenueReviewSchema } from '@repo/schemas';
import { ServiceError, VenueReviewService } from '@repo/service-core';
import type { Context } from 'hono';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import type { z } from '../../../utils/zod';

/** Stricter per-user write budget: 30 review submissions per hour. */
const writeReviewRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: 3_600_000,
    max: 30,
    keyPrefix: 'prot:write:review'
});

/**
 * Protected projection for the review response: omits admin-only moderation
 * decision fields that should not be surfaced to tourists on creation.
 */
const VenueReviewProtectedSchema = VenueReviewSchema.pick({
    id: true,
    venueId: true,
    userId: true,
    title: true,
    content: true,
    rating: true,
    averageRating: true,
    overallRating: true,
    reviewerName: true,
    moderationState: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * POST /api/v1/protected/venues/:venueId/reviews
 * Create a venue review — Protected endpoint.
 *
 * venueId and userId are supplied by the URL and the authenticated actor
 * respectively — the client MUST NOT echo them in the request body (they are
 * absent from VenueReviewCreateInputSchema... actually venueId IS
 * required there, so we merge it from the path param).
 */
export const protectedCreateVenueReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{venueId}/reviews',
    summary: 'Create venue reviews',
    description:
        'Submits a new review for a venue listing. The review starts in PENDING state awaiting moderation.',
    tags: ['Venue', 'Venue Reviews'],
    requestParams: {
        venueId: VenueReviewCreateInputSchema.shape.venueId
    },
    requestBody: VenueReviewCreateInputSchema.omit({ venueId: true }),
    responseSchema: VenueReviewProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = {
            ...(body as z.infer<typeof VenueReviewCreateInputSchema>),
            venueId: params.venueId as string
        };

        const service = new VenueReviewService({ logger: apiLogger });
        const result = await service.create(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        middlewares: [writeReviewRateLimit]
    }
});
