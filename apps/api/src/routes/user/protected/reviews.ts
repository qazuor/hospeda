/**
 * User reviews endpoint.
 * Returns paginated reviews by the authenticated user (accommodation + destination combined).
 * Each review is enriched with the parent entity's `name` and `slug` so the
 * web UI can render the entity link without a second round trip.
 * @route GET /api/v1/protected/users/me/reviews
 */
import { AccommodationModel, DestinationModel } from '@repo/db';
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
const accommodationModel = new AccommodationModel();
const destinationModel = new DestinationModel();

/** Response schema for combined user reviews. Items extend the base review
 * list-item schemas with the parent entity's display name + slug so the UI
 * can show "Hotel X" instead of an undefined entity label. */
const UserReviewsResponseSchema = z.object({
    accommodationReviews: z.array(
        AccommodationReviewListItemSchema.extend({
            accommodationName: z.string().nullable().optional(),
            accommodationSlug: z.string().nullable().optional()
        })
    ),
    destinationReviews: z.array(
        DestinationReviewListItemSchema.extend({
            destinationName: z.string().nullable().optional(),
            destinationSlug: z.string().nullable().optional()
        })
    ),
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

        const accommodationReviewsRaw = (accResult.data?.accommodationReviews ?? []) as Array<{
            accommodationId: string;
            [k: string]: unknown;
        }>;
        const accTotal = accResult.data?.total ?? 0;

        const destData = destResult.data as { data: unknown[]; pagination: { total: number } };
        const destinationReviewsRaw = (destData?.data ?? []) as Array<{
            destinationId: string;
            [k: string]: unknown;
        }>;
        const destTotal = destData?.pagination?.total ?? 0;

        // Enrich each review with its parent entity's name + slug. Done as
        // a batch lookup (one query per distinct id set) so the response is
        // self-contained for the UI; the underlying services intentionally
        // return raw rows so admin tooling stays cheap.
        const accommodationIds = [
            ...new Set(accommodationReviewsRaw.map((r) => r.accommodationId).filter(Boolean))
        ];
        const destinationIds = [
            ...new Set(destinationReviewsRaw.map((r) => r.destinationId).filter(Boolean))
        ];
        const [accommodationsById, destinationsById] = await Promise.all([
            accommodationIds.length > 0
                ? (async () => {
                      const map = new Map<string, { name?: string; slug?: string }>();
                      for (const id of accommodationIds) {
                          const row = await accommodationModel.findById(id);
                          if (row) {
                              map.set(id, {
                                  name: (row as { name?: string }).name,
                                  slug: (row as { slug?: string }).slug
                              });
                          }
                      }
                      return map;
                  })()
                : Promise.resolve(new Map<string, { name?: string; slug?: string }>()),
            destinationIds.length > 0
                ? (async () => {
                      const map = new Map<string, { name?: string; slug?: string }>();
                      for (const id of destinationIds) {
                          const row = await destinationModel.findById(id);
                          if (row) {
                              map.set(id, {
                                  name: (row as { name?: string }).name,
                                  slug: (row as { slug?: string }).slug
                              });
                          }
                      }
                      return map;
                  })()
                : Promise.resolve(new Map<string, { name?: string; slug?: string }>())
        ]);

        const accommodationReviews = accommodationReviewsRaw.map((r) => ({
            ...r,
            accommodationName: accommodationsById.get(r.accommodationId)?.name ?? null,
            accommodationSlug: accommodationsById.get(r.accommodationId)?.slug ?? null
        }));
        const destinationReviews = destinationReviewsRaw.map((r) => ({
            ...r,
            destinationName: destinationsById.get(r.destinationId)?.name ?? null,
            destinationSlug: destinationsById.get(r.destinationId)?.slug ?? null
        }));

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
