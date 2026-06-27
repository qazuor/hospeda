/**
 * Protected create gastronomy review endpoint (T-044)
 * A logged-in tourist (or any authenticated user) submits a review for a gastronomy listing.
 *
 * Behavior:
 * - moderationState is forced to PENDING by GastronomyReviewService._beforeCreate()
 *   (defense-in-depth; any caller-supplied value is silently overridden).
 * - One review per user per listing is enforced (ALREADY_EXISTS on duplicate).
 * - After creation, the listing's denormalized rating fields are recomputed.
 */
import type { z } from '@hono/zod-openapi';
import { GastronomyReviewCreateInputSchema, GastronomyReviewSchema } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * Protected projection for the review response: omits admin-only moderation
 * decision fields that should not be surfaced to tourists on creation.
 */
const GastronomyReviewProtectedSchema = GastronomyReviewSchema.pick({
    id: true,
    gastronomyId: true,
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
 * POST /api/v1/protected/gastronomies/:gastronomyId/reviews
 * Create a gastronomy review — Protected endpoint.
 *
 * gastronomyId and userId are supplied by the URL and the authenticated actor
 * respectively — the client MUST NOT echo them in the request body (they are
 * absent from GastronomyReviewCreateInputSchema... actually gastronomyId IS
 * required there, so we merge it from the path param).
 */
export const protectedCreateGastronomyReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/{gastronomyId}/reviews',
    summary: 'Create gastronomy review',
    description:
        'Submits a new review for a gastronomy listing. The review starts in PENDING state awaiting moderation.',
    tags: ['Gastronomy', 'Gastronomy Reviews'],
    requestParams: {
        gastronomyId: GastronomyReviewCreateInputSchema.shape.gastronomyId
    },
    requestBody: GastronomyReviewCreateInputSchema.omit({ gastronomyId: true }),
    responseSchema: GastronomyReviewProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = {
            ...(body as z.infer<typeof GastronomyReviewCreateInputSchema>),
            gastronomyId: params.gastronomyId as string
        };

        const service = new GastronomyReviewService({ logger: apiLogger });
        const result = await service.create(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
