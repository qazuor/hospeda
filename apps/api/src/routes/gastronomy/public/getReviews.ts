/**
 * Public gastronomy reviews list endpoint (T-042)
 * Returns a paginated list of APPROVED reviews for a specific gastronomy listing.
 *
 * GastronomyReviewService.listByGastronomy() force-filters lifecycleState=ACTIVE AND
 * moderationState=APPROVED so that PENDING / REJECTED reviews never surface here
 * (mirrors the SPEC-166 accommodation review pattern).
 */
import { GastronomyReviewSchema } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const reviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * Safe public review projection — strips admin-only and moderation fields
 * before the response leaves the public tier.
 */
const GastronomyReviewPublicSchema = GastronomyReviewSchema.pick({
    id: true,
    gastronomyId: true,
    userId: true,
    title: true,
    content: true,
    rating: true,
    averageRating: true,
    overallRating: true,
    reviewerName: true,
    createdAt: true,
    updatedAt: true
});

/**
 * GET /api/v1/public/gastronomies/:gastronomyId/reviews
 * List APPROVED gastronomy reviews — Public endpoint.
 *
 * Uses GastronomyReviewService.listByGastronomy() which force-filters to
 * ACTIVE + APPROVED reviews only. At most 100 reviews per call (service cap).
 */
export const publicListGastronomyReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{gastronomyId}/reviews',
    summary: 'List gastronomy reviews',
    description: 'Returns a paginated list of approved reviews for a specific gastronomy listing',
    tags: ['Gastronomy', 'Gastronomy Reviews'],
    requestParams: {
        gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyReviewPublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await reviewService.listByGastronomy(params.gastronomyId as string, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const reviews = result.data?.reviews || [];
        const total = result.data?.total || 0;

        // Parse page/pageSize from query for pagination metadata only.
        // listByGastronomy() uses a fixed cap of 100; no server-side pagination.
        const page = Number((query as Record<string, unknown>)?.page ?? 1);
        const pageSize = Math.min(Number((query as Record<string, unknown>)?.pageSize ?? 20), 100);

        return {
            items: reviews,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
