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

export type GetPopularDestinationsInput = z.infer<typeof getPopularDestinationsInputSchema>;
export type GetPopularDestinationsOutput = z.infer<typeof getPopularDestinationsOutputSchema>;
export type GetTopRatedAccommodationsInput = z.infer<typeof getTopRatedAccommodationsInputSchema>;
export type GetTopRatedAccommodationsOutput = z.infer<typeof getTopRatedAccommodationsOutputSchema>;
export type GetNextEventsInput = z.infer<typeof getNextEventsInputSchema>;
export type GetNextEventsOutput = z.infer<typeof getNextEventsOutputSchema>;
export type GetLatestPostsInput = z.infer<typeof getLatestPostsInputSchema>;
export type GetLatestPostsOutput = z.infer<typeof getLatestPostsOutputSchema>;
export type GetTestimonialsInput = z.infer<typeof getTestimonialsInputSchema>;
export type GetTestimonialsOutput = z.infer<typeof getTestimonialsOutputSchema>;
export type GetDestinationsListInput = z.infer<typeof getDestinationsListInputSchema>;
export type GetDestinationsListOutput = z.infer<typeof getDestinationsListOutputSchema>;
export type GetAccommodationsCategoriesOutput = z.infer<
    typeof getAccommodationsCategoriesOutputSchema
>;
