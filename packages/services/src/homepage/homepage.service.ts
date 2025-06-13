import {
    AccommodationModel,
    AccommodationReviewModel,
    DestinationModel,
    DestinationReviewModel,
    EventModel,
    PostModel
} from '@repo/db';
import type {
    AccommodationWithRelationsType,
    AmenityType,
    AttractionType,
    FeatureType
} from '@repo/types';
import { AccommodationTypeEnum } from '@repo/types';
import type {
    HomepageGetAccommodationsCategoriesOutput,
    HomepageGetDestinationsListInput,
    HomepageGetDestinationsListOutput,
    HomepageGetLatestPostsInput,
    HomepageGetLatestPostsOutput,
    HomepageGetNextEventsInput,
    HomepageGetNextEventsOutput,
    HomepageGetPopularDestinationsInput,
    HomepageGetPopularDestinationsOutput,
    HomepageGetTestimonialsInput,
    HomepageGetTestimonialsOutput,
    HomepageGetTopRatedAccommodationsInput,
    HomepageGetTopRatedAccommodationsOutput
} from './homepage.schemas';
import {
    HomepageGetAccommodationsCategoriesOutputSchema,
    HomepageGetDestinationsListInputSchema,
    HomepageGetDestinationsListOutputSchema,
    HomepageGetLatestPostsInputSchema,
    HomepageGetLatestPostsOutputSchema,
    HomepageGetNextEventsInputSchema,
    HomepageGetNextEventsOutputSchema,
    HomepageGetPopularDestinationsInputSchema,
    HomepageGetPopularDestinationsOutputSchema,
    HomepageGetTestimonialsInputSchema,
    HomepageGetTestimonialsOutputSchema,
    HomepageGetTopRatedAccommodationsInputSchema,
    HomepageGetTopRatedAccommodationsOutputSchema
} from './homepage.schemas';

/**
 * Service for homepage data aggregation and prerendering.
 * All methods are read-only and do not require user validation or permissions.
 */
export const homepageService = {
    /**
     * Returns the most popular destinations ordered by average rating.
     * @param input.limit - Maximum number of destinations to return
     * @returns List of popular destinations with summary data
     * @example
     *   const result = await homepageService.getPopularDestinations({ limit: 5 });
     */
    async getPopularDestinations(
        input: HomepageGetPopularDestinationsInput
    ): Promise<HomepageGetPopularDestinationsOutput> {
        // Validate input
        const parsedInput = HomepageGetPopularDestinationsInputSchema.parse(input);
        // Query destinations ordered by averageRating desc, with attractions
        const destinations = await DestinationModel.list(
            {
                limit: parsedInput.limit,
                offset: 0,
                orderBy: 'averageRating',
                order: 'desc',
                visibility: 'PUBLIC'
            },
            { attractions: true }
        );
        // Map to output schema
        const mapped = destinations.map((dest) => {
            // Extract main image from media
            let image: string | undefined = undefined;
            if (dest.media?.featuredImage?.url) {
                image = dest.media.featuredImage.url;
            }
            // Map attractions if present (access a.attraction)
            const attractions = (
                (dest as { attractions?: { attraction?: AttractionType }[] }).attractions ?? []
            )
                .filter(
                    (a) =>
                        !!a.attraction && a.attraction.id && a.attraction.name && a.attraction.slug
                )
                .map((a) => ({
                    id: a.attraction?.id,
                    name: a.attraction?.name,
                    slug: a.attraction?.slug,
                    description: a.attraction?.description,
                    icon: a.attraction?.icon
                }));
            return {
                id: dest.id,
                slug: dest.slug,
                name: dest.name,
                summary: dest.summary,
                reviewsCount: dest.reviewsCount,
                averageRating: dest.averageRating,
                image,
                accommodationsCount: dest.accommodationsCount,
                attractions
            };
        });
        // Validate output
        return HomepageGetPopularDestinationsOutputSchema.parse({ destinations: mapped });
    },

    /**
     * Returns the top rated accommodations across all destinations.
     * @param input.limit - Maximum number of accommodations to return
     * @returns List of top rated accommodations with details
     * @example
     *   const result = await homepageService.getTopRatedAccommodations({ limit: 5 });
     */
    async getTopRatedAccommodations(
        input: HomepageGetTopRatedAccommodationsInput
    ): Promise<HomepageGetTopRatedAccommodationsOutput> {
        // Validate input
        const parsedInput = HomepageGetTopRatedAccommodationsInputSchema.parse(input);
        // Fetch accommodations ordered by averageRating descending, with features and amenities
        const accommodations = await AccommodationModel.list(
            {
                limit: parsedInput.limit,
                offset: 0,
                orderBy: 'averageRating',
                order: 'desc'
                // Only public accommodations
                // (if you need to filter by visibility, uncomment the following line)
                // visibility: 'PUBLIC'
            },
            { features: true, amenities: true }
        );
        // Map to required output
        const mapped = (accommodations as AccommodationWithRelationsType[]).map((acc) => ({
            id: acc.id,
            slug: acc.slug,
            name: acc.name,
            summary: acc.summary,
            price: acc.price, // TODO: map/validate shape if needed
            reviewsCount: acc.reviewsCount,
            averageRating: acc.averageRating,
            amenities: (acc.amenities ?? []).map((a: AmenityType) => ({
                id: a.id,
                name: a.name,
                description: a.description,
                icon: a.icon
            })),
            features: (acc.features ?? []).map((f: FeatureType) => ({
                id: f.id,
                name: f.name,
                description: f.description,
                icon: f.icon
            }))
        }));
        // Validate and return output
        return HomepageGetTopRatedAccommodationsOutputSchema.parse({ accommodations: mapped });
    },

    /**
     * Returns the next upcoming events ordered by start date.
     * @param input.limit - Maximum number of events to return
     * @returns List of upcoming events
     * @example
     *   const result = await homepageService.getNextEvents({ limit: 5 });
     */
    async getNextEvents(input: HomepageGetNextEventsInput): Promise<HomepageGetNextEventsOutput> {
        // Validate input
        const parsedInput = HomepageGetNextEventsInputSchema.parse(input);
        // Fetch future events ordered by ascending start date
        const now = new Date();
        const events = await EventModel.search({
            limit: parsedInput.limit,
            offset: 0,
            orderBy: 'date', // Assuming 'date' is the start date field
            order: 'asc',
            minDate: now
        });
        // For each event, get the related destination (if exists)
        const mapped = await Promise.all(
            events.map(async (event) => {
                // Get related destination (if locationId exists)
                let destination: { id: string; name: string; slug: string } | undefined = undefined;
                if (event.locationId) {
                    // Find destination by locationId (assuming locationId references a destination)
                    // If not, search by city or appropriate field
                    const dest = await DestinationModel.getById(event.locationId);
                    if (dest) {
                        destination = {
                            id: dest.id,
                            name: dest.name,
                            slug: dest.slug
                        };
                    }
                }
                // Main image
                let image: string | undefined = undefined;
                if (event.media?.featuredImage?.url) {
                    image = event.media.featuredImage.url;
                }
                return {
                    id: event.id,
                    slug: event.slug,
                    name: event.summary, // No 'name', use summary as name
                    summary: event.summary,
                    startDate: event.date?.start?.toISOString?.() ?? '',
                    endDate: event.date?.end?.toISOString?.(),
                    destination,
                    image
                };
            })
        );
        // Filter events without destination (optional, according to schema)
        const filtered = mapped.filter((e) => e.destination);
        // Validate and return output
        return HomepageGetNextEventsOutputSchema.parse({ events: filtered });
    },

    /**
     * Returns the latest posts ordered by creation date.
     * @param input.limit - Maximum number of posts to return
     * @returns List of latest posts
     * @example
     *   const result = await homepageService.getLatestPosts({ limit: 5 });
     */
    async getLatestPosts(
        input: HomepageGetLatestPostsInput
    ): Promise<HomepageGetLatestPostsOutput> {
        // Validate input
        const parsedInput = HomepageGetLatestPostsInputSchema.parse(input);
        // Fetch latest posts ordered by createdAt desc
        const posts = await PostModel.list({
            limit: parsedInput.limit,
            offset: 0,
            orderBy: 'createdAt',
            order: 'desc'
        });
        // Map posts and fetch related entities in parallel
        const mapped = await Promise.all(
            posts.map(async (post) => {
                // Related accommodation
                let relatedAccommodation: { id: string; slug: string; name: string } | undefined =
                    undefined;
                if (post.relatedAccommodationId) {
                    const acc = await AccommodationModel.getById(post.relatedAccommodationId);
                    if (acc) {
                        relatedAccommodation = {
                            id: acc.id,
                            slug: acc.slug,
                            name: acc.name
                        };
                    }
                }
                // Related event
                let relatedEvent: { id: string; slug: string; name: string } | undefined =
                    undefined;
                if (post.relatedEventId) {
                    const event = await EventModel.getById(post.relatedEventId);
                    if (event) {
                        relatedEvent = {
                            id: event.id,
                            slug: event.slug,
                            name: event.summary // No name, use summary
                        };
                    }
                }
                // Related destination
                let relatedDestination: { id: string; slug: string; name: string } | undefined =
                    undefined;
                if (post.relatedDestinationId) {
                    const dest = await DestinationModel.getById(post.relatedDestinationId);
                    if (dest) {
                        relatedDestination = {
                            id: dest.id,
                            slug: dest.slug,
                            name: dest.name
                        };
                    }
                }
                // Main image
                let image: string | undefined = undefined;
                if (post.media?.featuredImage?.url) {
                    image = post.media.featuredImage.url;
                }
                return {
                    id: post.id,
                    slug: post.slug,
                    title: post.title,
                    summary: post.summary,
                    createdAt: post.createdAt.toISOString(),
                    image,
                    ...(relatedAccommodation ? { relatedAccommodation } : {}),
                    ...(relatedEvent ? { relatedEvent } : {}),
                    ...(relatedDestination ? { relatedDestination } : {})
                };
            })
        );
        // Validate and return output
        return HomepageGetLatestPostsOutputSchema.parse({ posts: mapped });
    },

    /**
     * Returns testimonials (reviews) from accommodations and destinations, filtered by average rating > 4 and randomized.
     * @param input.limit - Maximum number of testimonials to return
     * @returns List of testimonials
     * @example
     *   const result = await homepageService.getTestimonials({ limit: 5 });
     */
    async getTestimonials(
        input: HomepageGetTestimonialsInput
    ): Promise<HomepageGetTestimonialsOutput> {
        // Validate input
        const parsedInput = HomepageGetTestimonialsInputSchema.parse(input);
        // Fetch accommodation reviews with rating > 4
        const accReviews = await AccommodationReviewModel.list({
            limit: 100,
            offset: 0,
            order: 'desc',
            orderBy: 'createdAt'
        });
        // Fetch destination reviews with rating > 4
        const destReviews = await DestinationReviewModel.list({
            limit: 100,
            offset: 0,
            order: 'desc',
            orderBy: 'createdAt'
        });
        // Filter and map accommodation reviews
        const accFiltered = accReviews
            .map((r) => {
                const ratings = Object.values(r.rating ?? {});
                const avgRating =
                    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                return r.content && avgRating > 4
                    ? {
                          id: r.id,
                          entityType: 'accommodation' as const,
                          entityId: r.accommodationId,
                          author: 'Anonymous',
                          rating: Number.parseFloat(avgRating.toFixed(2)),
                          comment: r.content,
                          createdAt: r.createdAt.toISOString()
                      }
                    : undefined;
            })
            .filter(Boolean);
        // Filter and map destination reviews
        const destFiltered = destReviews
            .map((r) => {
                const ratings = Object.values(r.rating ?? {});
                const avgRating =
                    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                return r.content && avgRating > 4
                    ? {
                          id: r.id,
                          entityType: 'destination' as const,
                          entityId: r.destinationId,
                          author: 'Anonymous',
                          rating: Number.parseFloat(avgRating.toFixed(2)),
                          comment: r.content,
                          createdAt: r.createdAt.toISOString()
                      }
                    : undefined;
            })
            .filter(Boolean);
        // Map to unified testimonial shape
        const testimonials = [...accFiltered, ...destFiltered];
        // Shuffle testimonials
        for (let i = testimonials.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [testimonials[i], testimonials[j]] = [testimonials[j], testimonials[i]];
        }
        // Limit to input.limit
        const limited = testimonials.slice(0, parsedInput.limit);
        // Validate and return output
        return HomepageGetTestimonialsOutputSchema.parse({ testimonials: limited });
    },

    /**
     * Returns a basic list of destinations for the homepage.
     * @param input.limit - Maximum number of destinations to return
     * @returns List of destinations with basic info
     * @example
     *   const result = await homepageService.getDestinationsList({ limit: 10 });
     */
    async getDestinationsList(
        input: HomepageGetDestinationsListInput
    ): Promise<HomepageGetDestinationsListOutput> {
        // Validate input
        const parsedInput = HomepageGetDestinationsListInputSchema.parse(input);
        // Fetch destinations
        const destinations = await DestinationModel.list({
            limit: parsedInput.limit,
            offset: 0,
            orderBy: 'name',
            order: 'asc',
            visibility: 'PUBLIC'
        });
        // Map to required output
        const mapped = destinations.map((dest) => ({
            id: dest.id,
            slug: dest.slug,
            name: dest.name,
            image: dest.media?.featuredImage?.url
        }));
        // Validate and return output
        return HomepageGetDestinationsListOutputSchema.parse({ destinations: mapped });
    },

    /**
     * Returns the list of accommodation categories (from enum) that have at least one accommodation.
     * @returns List of accommodation categories
     * @example
     *   const result = await homepageService.getAccommodationsCategories();
     */
    async getAccommodationsCategories(): Promise<HomepageGetAccommodationsCategoriesOutput> {
        // Get all possible categories
        const allCategories = Object.values(AccommodationTypeEnum);
        // For each category, count accommodations
        const categoriesWithCount = await Promise.all(
            allCategories.map(async (category) => {
                const count = await AccommodationModel.count({
                    type: category,
                    limit: 1,
                    offset: 0
                });
                return { category, count };
            })
        );
        // Filter categories with at least one accommodation
        const filtered = categoriesWithCount.filter((c) => c.count > 0).map((c) => c.category);
        // Validate and return output
        return HomepageGetAccommodationsCategoriesOutputSchema.parse({ categories: filtered });
    }
};
