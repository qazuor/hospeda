/**
 * Host market comparison endpoint — SPEC-155 HOST card J.
 *
 * Returns, for each of the host's active accommodations, the listing's own
 * rating + base price alongside the average rating + price of every other
 * active accommodation in the same destination. The dashboard widget uses
 * the pairs to draw a "you vs destination" indicator per row.
 *
 * @route GET /api/v1/protected/accommodations/my/market-comparison
 */
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Response schema for the host market-comparison endpoint.
 *
 * Every accommodation entry exposes nullable destination averages so the
 * renderer can hide the comparison when the host is the only listing in
 * its destination (no peers to compare against).
 */
const HostMarketComparisonSchema = z.object({
    comparisons: z.array(
        z.object({
            accommodationId: z.string().uuid(),
            accommodationName: z.string(),
            accommodationType: z.string(),
            destinationId: z.string().uuid(),
            destinationName: z.string().nullable(),
            yourRating: z.number().nullable(),
            yourReviews: z.number().int().min(0),
            destinationAvgRating: z.number().nullable(),
            destinationReviewsTotal: z.number().int().min(0),
            yourPrice: z.number().nullable(),
            destinationAvgPrice: z.number().nullable()
        })
    )
});

/**
 * GET /api/v1/protected/accommodations/my/market-comparison
 *
 * For each accommodation owned by the authenticated host, returns the
 * comparison row used by HOST card J. Scoped to `ownerId = actor.id`.
 * Requires `ACCOMMODATION_VIEW_OWN`.
 */
export const hostMarketComparisonRoute = createProtectedRoute({
    method: 'get',
    path: '/my/market-comparison',
    summary: 'Get per-accommodation market comparison (host)',
    description:
        "Returns each of the host's active accommodations with their rating + " +
        'base price and the average rating + price of every other active ' +
        'accommodation in the same destination. Used by HOST card J.',
    tags: ['Accommodations'],
    responseSchema: HostMarketComparisonSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.getHostMarketComparison(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { comparisons: result.data ?? [] };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
