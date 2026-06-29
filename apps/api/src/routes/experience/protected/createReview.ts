/**
 * Protected create experience review endpoint (T-020)
 * A logged-in tourist (or any authenticated user) submits a review for an experience listing.
 *
 * Behavior:
 * - moderationState is forced to PENDING by ExperienceReviewService._beforeCreate()
 *   (defense-in-depth; any caller-supplied value is silently overridden).
 * - One review per user per listing is enforced (ALREADY_EXISTS on duplicate).
 * - After creation, the listing's denormalized rating fields are recomputed.
 */
import type { z } from '@hono/zod-openapi';
import { ExperienceReviewCreateInputSchema, ExperienceReviewSchema } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

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
const ExperienceReviewProtectedSchema = ExperienceReviewSchema.pick({
    id: true,
    experienceId: true,
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
 * POST /api/v1/protected/experiences/:experienceId/reviews
 * Create an experience review — Protected endpoint.
 *
 * experienceId and userId are supplied by the URL and the authenticated actor
 * respectively — the client MUST NOT echo them in the request body (they are
 * absent from ExperienceReviewCreateInputSchema... actually experienceId IS
 * required there, so we merge it from the path param).
 */
export const protectedCreateExperienceReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{experienceId}/reviews',
    summary: 'Create experience review',
    description:
        'Submits a new review for an experience listing. The review starts in PENDING state awaiting moderation.',
    tags: ['Experience', 'Experience Reviews'],
    requestParams: {
        experienceId: ExperienceReviewCreateInputSchema.shape.experienceId
    },
    requestBody: ExperienceReviewCreateInputSchema.omit({ experienceId: true }),
    responseSchema: ExperienceReviewProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = {
            ...(body as z.infer<typeof ExperienceReviewCreateInputSchema>),
            experienceId: params.experienceId as string
        };

        const service = new ExperienceReviewService({ logger: apiLogger });
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
