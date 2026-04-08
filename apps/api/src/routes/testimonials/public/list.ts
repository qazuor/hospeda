import { AccommodationReviewService, DestinationReviewService } from '@repo/service-core';
/**
 * Public testimonials endpoint
 * Returns mixed accommodation and destination reviews for the testimonials section
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

const TestimonialItemSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['accommodation', 'destination']),
    entityId: z.string().uuid(),
    entityName: z.string(),
    entitySlug: z.string().optional(),
    userName: z.string(),
    avatarUrl: z.string().url().optional(),
    rating: z.number(),
    comment: z.string(),
    date: z.string().datetime()
});

const TestimonialsResponseSchema = z.array(TestimonialItemSchema);

const TestimonialsQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(20).default(6)
});

function transformAccommodationReview(review: AccommodationReviewWithUser): TestimonialItem {
    const name =
        (review as unknown as { accommodation?: { name: string } }).accommodation?.name ??
        'Alojamiento';
    const slug = (review as unknown as { accommodation?: { slug: string } }).accommodation?.slug;
    const userName = review.user
        ? ((`${review.user.firstName ?? ''} ${review.user.lastName ?? ''}`.trim() ||
              review.user.displayName) ??
          'Usuario')
        : 'Usuario';

    return {
        id: review.id,
        type: 'accommodation',
        entityId: review.accommodationId,
        entityName: name,
        entitySlug: slug,
        userName,
        avatarUrl: review.user?.avatar,
        rating: review.averageRating,
        comment: review.content ?? review.title ?? '',
        date:
            review.createdAt instanceof Date
                ? review.createdAt.toISOString()
                : String(review.createdAt)
    };
}

function transformDestinationReview(review: DestinationReviewWithUser): TestimonialItem {
    const name =
        (review as unknown as { destination?: { name: string } }).destination?.name ?? 'Destino';
    const slug = (review as unknown as { destination?: { slug: string } }).destination?.slug;
    const userName = review.user
        ? ((`${review.user.firstName ?? ''} ${review.user.lastName ?? ''}`.trim() ||
              review.user.displayName) ??
          'Usuario')
        : 'Usuario';

    return {
        id: review.id,
        type: 'destination',
        entityId: review.destinationId,
        entityName: name,
        entitySlug: slug,
        userName,
        avatarUrl: review.user?.avatar,
        rating: review.averageRating,
        comment: review.content ?? review.title ?? '',
        date:
            review.createdAt instanceof Date
                ? review.createdAt.toISOString()
                : String(review.createdAt)
    };
}

type TestimonialItem = z.infer<typeof TestimonialItemSchema>;
type AccommodationReviewWithUser = {
    id: string;
    accommodationId: string;
    averageRating: number;
    content?: string;
    title?: string;
    createdAt: Date | string;
    user?: {
        firstName?: string;
        lastName?: string;
        displayName?: string;
        avatar?: string;
    };
    // accommodation is included by the query but we need to cast
};

type DestinationReviewWithUser = {
    id: string;
    destinationId: string;
    averageRating: number;
    content?: string;
    title?: string;
    createdAt: Date | string;
    user?: {
        firstName?: string;
        lastName?: string;
        displayName?: string;
        avatar?: string;
    };
};

/**
 * GET /api/v1/public/testimonials
 * List recent testimonials from both accommodations and destinations
 */
export const publicListTestimonialsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List testimonials',
    description: 'Returns a mixed list of recent reviews from accommodations and destinations',
    tags: ['Testimonials'],
    requestQuery: TestimonialsQuerySchema.shape,
    responseSchema: TestimonialsResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const halfPageSize = Math.floor(pageSize / 2);

        const [accommodationResult, destinationResult] = await Promise.all([
            accommodationReviewService.listWithUser(actor, {
                page: 1,
                pageSize: halfPageSize
            }),
            destinationReviewService.listWithUser(actor, {
                page: 1,
                pageSize: halfPageSize
            })
        ]);

        const accommodationReviewsRaw =
            (accommodationResult.data as unknown as { accommodationReviews?: unknown[] })
                ?.accommodationReviews ?? [];
        const accommodationReviews: AccommodationReviewWithUser[] =
            accommodationReviewsRaw as AccommodationReviewWithUser[];

        const destinationReviewsRaw =
            (destinationResult.data as unknown as { data?: unknown[] })?.data ?? [];
        const destinationReviews: DestinationReviewWithUser[] =
            destinationReviewsRaw as DestinationReviewWithUser[];

        const testimonials: TestimonialItem[] = [
            ...accommodationReviews.map(transformAccommodationReview),
            ...destinationReviews.map(transformDestinationReview)
        ];

        testimonials.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const total = testimonials.length;

        return {
            items: testimonials.slice(0, pageSize),
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
