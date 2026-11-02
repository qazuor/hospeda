/**
 * User reviews endpoint.
 * Returns paginated reviews by the authenticated user (accommodation + destination combined).
 * Accommodation reviews include a gone marker when their listing was deleted
 * or no longer exists, so the web UI can avoid a broken entity link.
 * @route GET /api/v1/protected/users/me/reviews
 */
import { AccommodationModel, DestinationModel } from '@repo/db';
import {
    AccommodationReviewListItemSchema,
    DestinationReviewListItemSchema,
    ModerationStatusEnumSchema,
    PublicationStatusEnum
} from '@repo/schemas';
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

/** Response schema for combined user reviews. Accommodation items include a
 * gone marker when their listing was deleted or no longer exists. */
const UserReviewsResponseSchema = z.object({
    accommodationReviews: z.array(
        AccommodationReviewListItemSchema.extend({
            accommodationName: z.string().nullable().optional(),
            accommodationSlug: z.string().nullable().optional(),
            /** True when the listing was deleted (soft delete) or purged, or no longer exists: the review stays visible and counted for its author, but there is nothing to link to. */
            accommodationGone: z.boolean(),
            // Moderation state so the user's "my reviews" view can flag reviews
            // still pending approval or rejected. Only exposed on this owner-scoped
            // endpoint, not on the shared public list-item schema.
            moderationState: ModerationStatusEnumSchema.optional()
        })
    ),
    destinationReviews: z.array(
        DestinationReviewListItemSchema.extend({
            destinationName: z.string().nullable().optional(),
            destinationSlug: z.string().nullable().optional(),
            moderationState: ModerationStatusEnumSchema.optional()
        })
    ),
    totals: z.object({
        accommodationReviews: z.number(),
        destinationReviews: z.number(),
        total: z.number()
    })
});

/** Returns whether the listing row is deleted, purged, or missing. */
function isListingGone({
    row
}: {
    row: Awaited<ReturnType<AccommodationModel['findByIds']>>[number] | undefined;
}): boolean {
    return (
        row === undefined ||
        (row.deletedAt !== null && row.deletedAt !== undefined) ||
        row.publicationStatus === PublicationStatusEnum.PURGED
    );
}

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

        // Enrich each review with its parent entity's name + slug.
        // Uses a single batch query per entity type (WHERE id IN (...)) to avoid
        // the N+1 problem that sequential findById calls in a loop would cause.
        const accommodationIds = [
            ...new Set(accommodationReviewsRaw.map((r) => r.accommodationId).filter(Boolean))
        ];
        const destinationIds = [
            ...new Set(destinationReviewsRaw.map((r) => r.destinationId).filter(Boolean))
        ];
        const [accommodationRows, destinationRows] = await Promise.all([
            accommodationModel.findByIds(accommodationIds),
            destinationModel.findByIds(destinationIds)
        ]);

        const accommodationsById = new Map<string, { name?: string; slug?: string; gone: boolean }>(
            accommodationRows.map((row) => [
                row.id,
                {
                    name: row.name,
                    slug: row.slug,
                    gone: isListingGone({ row })
                }
            ])
        );
        const destinationsById = new Map<string, { name?: string; slug?: string }>(
            destinationRows.map((row) => [
                (row as { id: string }).id,
                {
                    name: (row as { name?: string }).name,
                    slug: (row as { slug?: string }).slug
                }
            ])
        );

        const accommodationReviews = accommodationReviewsRaw.map((r) => {
            const accommodation = accommodationsById.get(r.accommodationId);
            const accommodationGone = accommodation?.gone ?? true;
            return {
                ...r,
                accommodationName: accommodation?.name ?? null,
                accommodationSlug: accommodationGone ? null : (accommodation?.slug ?? null),
                accommodationGone
            };
        });
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
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
