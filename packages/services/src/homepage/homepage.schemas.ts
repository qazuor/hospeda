import { z } from 'zod';

/**
 * Input schema for getPopularDestinations
 */
export const getPopularDestinationsInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getPopularDestinations
 */
export const getPopularDestinationsOutputSchema = z.object({
    destinations: z.array(
        z.object({
            id: z.string().uuid(),
            slug: z.string(),
            name: z.string(),
            summary: z.string(),
            reviewsCount: z.number().int().nonnegative(),
            averageRating: z.number().min(0).max(5),
            image: z.string().url().optional(),
            accommodationsCount: z.number().int().nonnegative(),
            attractions: z.array(
                z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    slug: z.string(),
                    description: z.string().optional(),
                    icon: z.string().optional()
                })
            )
        })
    )
});

/**
 * Input schema for getTopRatedAccommodations
 */
export const getTopRatedAccommodationsInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getTopRatedAccommodations
 */
export const getTopRatedAccommodationsOutputSchema = z.object({
    accommodations: z.array(
        z.object({
            id: z.string().uuid(),
            slug: z.string(),
            name: z.string(),
            summary: z.string(),
            price: z.any(), // TODO: Replace with AccommodationPriceType schema
            reviewsCount: z.number().int().nonnegative(),
            averageRating: z.number().min(0).max(5),
            amenities: z.array(
                z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    description: z.string().optional(),
                    icon: z.string().optional()
                })
            ),
            features: z.array(
                z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    description: z.string().optional(),
                    icon: z.string().optional()
                })
            )
        })
    )
});

/**
 * Input schema for getNextEvents
 */
export const getNextEventsInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getNextEvents
 */
export const getNextEventsOutputSchema = z.object({
    events: z.array(
        z.object({
            id: z.string().uuid(),
            slug: z.string(),
            name: z.string(),
            summary: z.string(),
            startDate: z.string(), // ISO date string
            endDate: z.string().optional(), // ISO date string
            destination: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string()
            }),
            image: z.string().url().optional()
        })
    )
});

/**
 * Input schema for getLatestPosts
 */
export const getLatestPostsInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getLatestPosts
 */
export const getLatestPostsOutputSchema = z.object({
    posts: z.array(
        z.object({
            id: z.string().uuid(),
            slug: z.string(),
            title: z.string(),
            summary: z.string(),
            createdAt: z.string(), // ISO date string
            image: z.string().url().optional(),
            relatedAccommodation: z
                .object({ id: z.string().uuid(), slug: z.string(), name: z.string() })
                .optional(),
            relatedEvent: z
                .object({ id: z.string().uuid(), slug: z.string(), name: z.string() })
                .optional(),
            relatedDestination: z
                .object({ id: z.string().uuid(), slug: z.string(), name: z.string() })
                .optional()
        })
    )
});

/**
 * Input schema for getTestimonials
 */
export const getTestimonialsInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getTestimonials
 */
export const getTestimonialsOutputSchema = z.object({
    testimonials: z.array(
        z.object({
            id: z.string().uuid(),
            entityType: z.enum(['accommodation', 'destination']),
            entityId: z.string().uuid(),
            author: z.string(),
            rating: z.number().min(0).max(5),
            comment: z.string(),
            createdAt: z.string() // ISO date string
        })
    )
});

/**
 * Input schema for getDestinationsList
 */
export const getDestinationsListInputSchema = z.object({
    limit: z.number().int().positive().max(50)
});

/**
 * Output schema for getDestinationsList
 */
export const getDestinationsListOutputSchema = z.object({
    destinations: z.array(
        z.object({
            id: z.string().uuid(),
            slug: z.string(),
            name: z.string(),
            image: z.string().url().optional()
        })
    )
});

/**
 * Output schema for getAccommodationsCategories
 */
export const getAccommodationsCategoriesOutputSchema = z.object({
    categories: z.array(z.string()) // TODO: Replace with enum if available
});

// Popular Destinations
export const HomepageGetPopularDestinationsInputSchema = getPopularDestinationsInputSchema;
export const HomepageGetPopularDestinationsOutputSchema = getPopularDestinationsOutputSchema;
export type HomepageGetPopularDestinationsInput = z.infer<
    typeof HomepageGetPopularDestinationsInputSchema
>;
export type HomepageGetPopularDestinationsOutput = z.infer<
    typeof HomepageGetPopularDestinationsOutputSchema
>;

// Top Rated Accommodations
export const HomepageGetTopRatedAccommodationsInputSchema = getTopRatedAccommodationsInputSchema;
export const HomepageGetTopRatedAccommodationsOutputSchema = getTopRatedAccommodationsOutputSchema;
export type HomepageGetTopRatedAccommodationsInput = z.infer<
    typeof HomepageGetTopRatedAccommodationsInputSchema
>;
export type HomepageGetTopRatedAccommodationsOutput = z.infer<
    typeof HomepageGetTopRatedAccommodationsOutputSchema
>;

// Next Events
export const HomepageGetNextEventsInputSchema = getNextEventsInputSchema;
export const HomepageGetNextEventsOutputSchema = getNextEventsOutputSchema;
export type HomepageGetNextEventsInput = z.infer<typeof HomepageGetNextEventsInputSchema>;
export type HomepageGetNextEventsOutput = z.infer<typeof HomepageGetNextEventsOutputSchema>;

// Latest Posts
export const HomepageGetLatestPostsInputSchema = getLatestPostsInputSchema;
export const HomepageGetLatestPostsOutputSchema = getLatestPostsOutputSchema;
export type HomepageGetLatestPostsInput = z.infer<typeof HomepageGetLatestPostsInputSchema>;
export type HomepageGetLatestPostsOutput = z.infer<typeof HomepageGetLatestPostsOutputSchema>;

// Testimonials
export const HomepageGetTestimonialsInputSchema = getTestimonialsInputSchema;
export const HomepageGetTestimonialsOutputSchema = getTestimonialsOutputSchema;
export type HomepageGetTestimonialsInput = z.infer<typeof HomepageGetTestimonialsInputSchema>;
export type HomepageGetTestimonialsOutput = z.infer<typeof HomepageGetTestimonialsOutputSchema>;

// Destinations List
export const HomepageGetDestinationsListInputSchema = getDestinationsListInputSchema;
export const HomepageGetDestinationsListOutputSchema = getDestinationsListOutputSchema;
export type HomepageGetDestinationsListInput = z.infer<
    typeof HomepageGetDestinationsListInputSchema
>;
export type HomepageGetDestinationsListOutput = z.infer<
    typeof HomepageGetDestinationsListOutputSchema
>;

// Accommodations Categories
export const HomepageGetAccommodationsCategoriesOutputSchema =
    getAccommodationsCategoriesOutputSchema;
export type HomepageGetAccommodationsCategoriesOutput = z.infer<
    typeof HomepageGetAccommodationsCategoriesOutputSchema
>;
