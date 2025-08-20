import { ensureDatabase } from '@/server/db';
import {
    AccommodationReviewService,
    AccommodationService,
    DestinationReviewService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { AccommodationType, DestinationType, EventType, PostType } from '@repo/types';

import { getCurrentUser } from '@/data/user';

/**
 * Unified testimonial type combining accommodation and destination reviews
 */
export type TestimonialType = {
    id: string;
    rating: number;
    comment: string;
    authorName: string;
    authorLocation?: string;
    relatedName: string; // accommodation or destination name
    relatedType: 'accommodation' | 'destination';
    createdAt: Date;
};

/**
 * Returns the data required by the Home page sections.
 * - destinations: featured destinations
 * - accommodations: featured accommodations (client-side filtered from first page)
 * - events: upcoming events from today
 * - posts: featured posts
 * - testimonials: combined accommodation and destination reviews
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getHomeData = async ({
    locals
}: { locals?: { auth?: LocalsAuth } } = {}): Promise<{
    destinations: DestinationType[];
    accommodations: AccommodationType[];
    events: EventType[];
    posts: PostType[];
    testimonials: TestimonialType[];
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const destinationService = new DestinationService({});
    const postService = new PostService({});
    const eventService = new EventService({});

    const [destRes, postRes, eventRes] = await Promise.all([
        // Featured destinations (filters: isFeatured true)
        destinationService.search(actor, {
            filters: { isFeatured: true },
            pagination: { page: 1, pageSize: 8 }
        }),
        // Latest posts (fallback to featured for demo; ideally use getFeatured or category)
        postService.getFeatured(actor, {}),
        // Upcoming events from today forward
        eventService.getUpcoming(actor, { fromDate: new Date(), page: 1, pageSize: 6 })
    ]);

    const destinations = destRes.data?.items ?? [];
    const posts = postRes.data ?? [];
    const events = eventRes.data?.items ?? [];

    // For home “FeaturedAccommodations”: use top-rated already filtered and ordered
    const accommodationService = new AccommodationService({});
    const topRatedRes = await accommodationService.getTopRated(actor, {
        limit: 9,
        onlyFeatured: true
    });
    const accommodations: AccommodationType[] = topRatedRes.data ?? [];

    // Testimonials: Get recent reviews from both accommodations and destinations
    const accommodationReviewService = new AccommodationReviewService({});
    const destinationReviewService = new DestinationReviewService({});

    const [accommodationReviewsRes, destinationReviewsRes] = await Promise.all([
        accommodationReviewService.listWithUser(actor, { page: 1, pageSize: 15 }),
        destinationReviewService.listWithUser(actor, { page: 1, pageSize: 15 })
    ]);

    const accommodationReviews = accommodationReviewsRes.data?.items ?? [];
    const destinationReviews = destinationReviewsRes.data?.items ?? [];

    // Get unique accommodation and destination IDs to fetch names
    const accommodationIds = [...new Set(accommodationReviews.map((r) => r.accommodationId))];
    const destinationIds = [...new Set(destinationReviews.map((r) => r.destinationId))];

    // Fetch accommodation and destination names
    const [accommodationNames, destinationNames] = await Promise.all([
        Promise.all(
            accommodationIds.map(async (id) => {
                const result = await accommodationService.getById(actor, id);
                return { id, name: result.data?.name || 'Alojamiento' };
            })
        ),
        Promise.all(
            destinationIds.map(async (id) => {
                const result = await destinationService.getById(actor, id);
                return { id, name: result.data?.name || 'Destino' };
            })
        )
    ]);

    // Create lookup maps
    const accommodationNameMap = new Map(accommodationNames.map((item) => [item.id, item.name]));
    const destinationNameMap = new Map(destinationNames.map((item) => [item.id, item.name]));

    // Transform reviews into unified testimonial format, filtering out reviews without content
    const accommodationTestimonials: TestimonialType[] = accommodationReviews
        .filter((review) => review.content || review.title) // Only include reviews with content
        .map((review) => {
            // Calculate average rating if it's an object
            const avgRating =
                typeof review.rating === 'object'
                    ? Object.values(review.rating).reduce((sum, val) => sum + val, 0) /
                      Object.values(review.rating).length
                    : review.rating;

            // Get user name from the user relation
            const userName = review.user
                ? `${review.user.firstName || ''} ${review.user.lastName || ''}`.trim() ||
                  review.user.email?.split('@')[0] ||
                  'Usuario Anónimo'
                : `Usuario ${review.userId.slice(0, 8)}`;

            // Get comment from content or title (we filtered to ensure at least one exists)
            const comment = review.content || review.title || '';

            return {
                id: review.id,
                rating: avgRating,
                comment,
                authorName: userName,
                authorLocation: undefined,
                relatedName: accommodationNameMap.get(review.accommodationId) || 'Alojamiento',
                relatedType: 'accommodation' as const,
                createdAt: review.createdAt
            };
        });

    const destinationTestimonials: TestimonialType[] = destinationReviews
        .filter((review) => review.content || review.title) // Only include reviews with content
        .map((review) => {
            // Calculate average rating if it's an object
            const avgRating =
                typeof review.rating === 'object'
                    ? Object.values(review.rating).reduce((sum, val) => sum + val, 0) /
                      Object.values(review.rating).length
                    : review.rating;

            // Get user name from the user relation
            const userName = review.user
                ? `${review.user.firstName || ''} ${review.user.lastName || ''}`.trim() ||
                  review.user.email?.split('@')[0] ||
                  'Usuario Anónimo'
                : `Usuario ${review.userId.slice(0, 8)}`;

            // Get comment from content or title (we filtered to ensure at least one exists)
            const comment = review.content || review.title || '';

            return {
                id: review.id,
                rating: avgRating,
                comment,
                authorName: userName,
                authorLocation: undefined,
                relatedName: destinationNameMap.get(review.destinationId) || 'Destino',
                relatedType: 'destination' as const,
                createdAt: review.createdAt
            };
        });

    // Combine and sort by creation date, avoiding duplicates of the same accommodation/destination
    const allTestimonials = [...accommodationTestimonials, ...destinationTestimonials].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Remove duplicates based on related entity (accommodation/destination)
    const seenEntities = new Set<string>();
    const uniqueTestimonials = allTestimonials.filter((testimonial) => {
        const entityKey = `${testimonial.relatedType}-${testimonial.relatedName}`;
        if (seenEntities.has(entityKey)) {
            return false; // Skip duplicate
        }
        seenEntities.add(entityKey);
        return true;
    });

    const testimonials: TestimonialType[] = uniqueTestimonials.slice(0, 6); // Limit to 6 testimonials

    return { destinations, accommodations, events, posts, testimonials };
};
