import { ensureDatabase } from '@/server/db';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type {
    AccommodationReviewType,
    AccommodationType,
    DestinationType,
    EventType,
    PostType
} from '@repo/types';

import { getCurrentUser } from '@/data/user';

/**
 * Returns the data required by the Home page sections.
 * - destinations: featured destinations
 * - accommodations: featured accommodations (client-side filtered from first page)
 * - events: upcoming events from today
 * - posts: featured posts
 * - testimonials: accommodation reviews (placeholder until wired)
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getHomeData = async ({
    locals
}: { locals?: { auth?: LocalsAuth } } = {}): Promise<{
    destinations: DestinationType[];
    accommodations: AccommodationType[];
    events: EventType[];
    posts: PostType[];
    testimonials: AccommodationReviewType[];
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

    // Testimonials: source from accommodation reviews service would be ideal, placeholder empty for now
    const testimonials: AccommodationReviewType[] = [];

    return { destinations, accommodations, events, posts, testimonials };
};
