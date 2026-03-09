/**
 * User reviews endpoint.
 * Returns paginated reviews by the authenticated user (accommodation + destination combined).
 * @route GET /api/v1/protected/users/me/reviews
 */
import { AccommodationReviewListItemSchema, DestinationReviewListItemSchema } from '@repo/schemas';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams } from '../../../utils/pagination';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/** Response schema for combined user reviews */
const UserReviewsResponseSchema = z.object({
    accommodationReviews: z.array(AccommodationReviewListItemSchema),
    destinationReviews: z.array(DestinationReviewListItemSchema),
    totals: z.object({
        accommodationReviews: z.number(),
        destinationReviews: z.number(),
        total: z.number()
    })
});

export const userReviewsRoute = createProtectedRoute({
    method: 'get',
    path: '/me/reviews',
    summary: 'List user reviews',
    description:
        'Returns paginated accommodation and destination reviews written by the authenticated user.',
    tags: ['Users', 'Reviews'],
    requestQuery: {
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
        type: z.enum(['accommodation', 'destination', 'all']).default('all')
    },
    responseSchema: UserReviewsResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const type = (query?.type as string) || 'all';

        const fetchAccommodation = type === 'all' || type === 'accommodation';
        const fetchDestination = type === 'all' || type === 'destination';

        const [accResult, destResult] = await Promise.all([
            fetchAccommodation
                ? accommodationReviewService.listByUser(actor, {
                      userId: actor.id,
                      page,
                      pageSize,
                      sortBy: 'createdAt' as const,
                      sortOrder: 'desc' as const
                  })
                : Promise.resolve({
                      data: { accommodationReviews: [], total: 0 },
                      error: undefined
                  }),
            fetchDestination
                ? destinationReviewService.listByUser(actor, {
                      userId: actor.id,
                      page,
                      pageSize,
                      sortBy: 'createdAt' as const,
                      sortOrder: 'desc' as const
                  })
                : Promise.resolve({
                      data: { data: [], pagination: { total: 0 } },
                      error: undefined
                  })
        ]);

        if (accResult.error) {
            throw new ServiceError(accResult.error.code, accResult.error.message);
        }
        if (destResult.error) {
            throw new ServiceError(destResult.error.code, destResult.error.message);
        }

        const accommodationReviews = accResult.data?.accommodationReviews ?? [];
        const accTotal = accResult.data?.total ?? 0;

        const destData = destResult.data as { data: unknown[]; pagination: { total: number } };
        const destinationReviews = destData?.data ?? [];
        const destTotal = destData?.pagination?.total ?? 0;

        return {
            accommodationReviews,
            destinationReviews,
            totals: {
                accommodationReviews: accTotal,
                destinationReviews: destTotal,
                total: accTotal + destTotal
            }
        };
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
