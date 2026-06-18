/**
 * Public experience reviews list endpoint (T-019)
 * Returns a paginated list of APPROVED reviews for a specific experience listing.
 *
 * ExperienceReviewService.listByExperience() force-filters lifecycleState=ACTIVE AND
 * moderationState=APPROVED so that PENDING / REJECTED reviews never surface here
 * (mirrors the SPEC-166 accommodation review pattern).
 */
import { ExperienceReviewSchema } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const reviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * Safe public review projection — strips admin-only and moderation fields
 * before the response leaves the public tier.
 */
const ExperienceReviewPublicSchema = ExperienceReviewSchema.pick({
    id: true,
    experienceId: true,
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
 * GET /api/v1/public/experiences/:experienceId/reviews
 * List APPROVED experience reviews — Public endpoint.
 *
 * Uses ExperienceReviewService.listByExperience() which force-filters to
 * ACTIVE + APPROVED reviews only. At most 100 reviews per call (service cap).
 */
export const publicListExperienceReviewsRoute = createPublicListRoute({
    method: 'get',
    path: '/{experienceId}/reviews',
    summary: 'List experience reviews',
    description: 'Returns a paginated list of approved reviews for a specific experience listing',
    tags: ['Experience', 'Experience Reviews'],
    requestParams: {
        experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceReviewPublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await reviewService.listByExperience(params.experienceId as string, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const reviews = result.data?.reviews || [];
        const total = result.data?.total || 0;

        // Parse page/pageSize from query for pagination metadata only.
        // listByExperience() uses a fixed cap of 100; no server-side pagination.
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
