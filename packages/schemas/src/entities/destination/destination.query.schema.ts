import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * Destination Query Schemas
 *
 * This file contains all schemas related to querying destinations:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Summary
 * - Stats
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for destination-specific filters
 * Used in list and search operations
 */
export const DestinationFiltersSchema = z.object({
    // Basic filters
    isFeatured: z
        .boolean({
            message: 'zodError.destination.filters.isFeatured.invalidType'
        })
        .optional(),

    // Location filters
    country: z
        .string({
            message: 'zodError.destination.filters.country.invalidType'
        })
        .min(2, { message: 'zodError.destination.filters.country.min' })
        .max(2, { message: 'zodError.destination.filters.country.max' })
        .optional(),

    state: z
        .string({
            message: 'zodError.destination.filters.state.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.state.min' })
        .max(100, { message: 'zodError.destination.filters.state.max' })
        .optional(),

    city: z
        .string({
            message: 'zodError.destination.filters.city.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.city.min' })
        .max(100, { message: 'zodError.destination.filters.city.max' })
        .optional(),

    // Location radius search
    latitude: z
        .number({
            message: 'zodError.destination.filters.latitude.invalidType'
        })
        .min(-90, { message: 'zodError.destination.filters.latitude.min' })
        .max(90, { message: 'zodError.destination.filters.latitude.max' })
        .optional(),

    longitude: z
        .number({
            message: 'zodError.destination.filters.longitude.invalidType'
        })
        .min(-180, { message: 'zodError.destination.filters.longitude.min' })
        .max(180, { message: 'zodError.destination.filters.longitude.max' })
        .optional(),

    radius: z
        .number({
            message: 'zodError.destination.filters.radius.invalidType'
        })
        .min(0, { message: 'zodError.destination.filters.radius.min' })
        .max(1000, { message: 'zodError.destination.filters.radius.max' })
        .optional(),

    // Accommodation count filters
    minAccommodations: z
        .number({
            message: 'zodError.destination.filters.minAccommodations.invalidType'
        })
        .int({ message: 'zodError.destination.filters.minAccommodations.int' })
        .min(0, { message: 'zodError.destination.filters.minAccommodations.min' })
        .optional(),

    maxAccommodations: z
        .number({
            message: 'zodError.destination.filters.maxAccommodations.invalidType'
        })
        .int({ message: 'zodError.destination.filters.maxAccommodations.int' })
        .min(0, { message: 'zodError.destination.filters.maxAccommodations.min' })
        .optional(),

    // Rating filter
    minRating: z
        .number({
            message: 'zodError.destination.filters.minRating.invalidType'
        })
        .min(0, { message: 'zodError.destination.filters.minRating.min' })
        .max(5, { message: 'zodError.destination.filters.minRating.max' })
        .optional(),

    // Tags filter
    tags: z
        .array(z.string().uuid({ message: 'zodError.destination.filters.tags.item.uuid' }))
        .optional(),

    // Attractions filter
    hasAttractions: z
        .boolean({
            message: 'zodError.destination.filters.hasAttractions.invalidType'
        })
        .optional(),

    // Climate/season filters
    climate: z
        .string({
            message: 'zodError.destination.filters.climate.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.climate.min' })
        .max(50, { message: 'zodError.destination.filters.climate.max' })
        .optional(),

    bestSeason: z
        .string({
            message: 'zodError.destination.filters.bestSeason.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.bestSeason.min' })
        .max(50, { message: 'zodError.destination.filters.bestSeason.max' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for destination list input parameters
 * Includes pagination and filters
 */
export const DestinationListInputSchema = PaginationSchema.extend({
    filters: DestinationFiltersSchema.optional()
});

/**
 * Schema for individual destination items in lists
 * Contains essential fields for list display
 */
export const DestinationListItemSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    location: true,
    media: true,
    rating: true,
    accommodationsCount: true,
    attractionsCount: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for destination list output
 * Uses generic paginated response with list items
 */
export const DestinationListOutputSchema = z.object({
    items: z.array(DestinationListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for destination search input parameters
 * Extends base search with destination-specific filters
 */
export const DestinationSearchInputSchema = BaseSearchSchema.extend({
    filters: DestinationFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.destination.search.query.invalidType'
        })
        .min(1, { message: 'zodError.destination.search.query.min' })
        .max(100, { message: 'zodError.destination.search.query.max' })
        .optional()
});

/**
 * Schema for individual destination search results
 * Extends list item with search score
 */
export const DestinationSearchResultSchema = DestinationListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.destination.search.score.invalidType'
        })
        .min(0, { message: 'zodError.destination.search.score.min' })
        .max(1, { message: 'zodError.destination.search.score.max' })
        .optional()
});

/**
 * Schema for destination search output
 * Uses generic paginated response with search results
 */
export const DestinationSearchOutputSchema = z.object({
    items: z.array(DestinationSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0)
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for destination summary
 * Contains essential information for quick display
 */
export const DestinationSummarySchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    location: true,
    media: true,
    rating: true,
    accommodationsCount: true,
    attractionsCount: true
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for destination statistics
 * Contains metrics and analytics data
 */
export const DestinationStatsSchema = z.object({
    // Accommodation statistics
    accommodationsCount: z
        .number({
            message: 'zodError.destination.stats.accommodationsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.accommodationsCount.int' })
        .min(0, { message: 'zodError.destination.stats.accommodationsCount.min' })
        .default(0),

    averageAccommodationRating: z
        .number({
            message: 'zodError.destination.stats.averageAccommodationRating.invalidType'
        })
        .min(0, { message: 'zodError.destination.stats.averageAccommodationRating.min' })
        .max(5, { message: 'zodError.destination.stats.averageAccommodationRating.max' })
        .default(0),

    // Attraction statistics
    attractionsCount: z
        .number({
            message: 'zodError.destination.stats.attractionsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.attractionsCount.int' })
        .min(0, { message: 'zodError.destination.stats.attractionsCount.min' })
        .default(0),

    // Review statistics
    reviewsCount: z
        .number({
            message: 'zodError.destination.stats.reviewsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.reviewsCount.int' })
        .min(0, { message: 'zodError.destination.stats.reviewsCount.min' })
        .default(0),

    averageRating: z
        .number({
            message: 'zodError.destination.stats.averageRating.invalidType'
        })
        .min(0, { message: 'zodError.destination.stats.averageRating.min' })
        .max(5, { message: 'zodError.destination.stats.averageRating.max' })
        .default(0),

    // Rating distribution
    ratingDistribution: z
        .object({
            oneStar: z.number().int().min(0).default(0),
            twoStars: z.number().int().min(0).default(0),
            threeStars: z.number().int().min(0).default(0),
            fourStars: z.number().int().min(0).default(0),
            fiveStars: z.number().int().min(0).default(0)
        })
        .optional(),

    // View statistics
    viewsCount: z
        .number({
            message: 'zodError.destination.stats.viewsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.viewsCount.int' })
        .min(0, { message: 'zodError.destination.stats.viewsCount.min' })
        .default(0),

    // Favorites/bookmarks
    favoritesCount: z
        .number({
            message: 'zodError.destination.stats.favoritesCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.favoritesCount.int' })
        .min(0, { message: 'zodError.destination.stats.favoritesCount.min' })
        .default(0),

    // Content statistics
    photosCount: z
        .number({
            message: 'zodError.destination.stats.photosCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.photosCount.int' })
        .min(0, { message: 'zodError.destination.stats.photosCount.min' })
        .default(0),

    // Accommodation type distribution
    accommodationTypeDistribution: z
        .object({
            hotel: z.number().int().min(0).default(0),
            cabin: z.number().int().min(0).default(0),
            hostel: z.number().int().min(0).default(0),
            apartment: z.number().int().min(0).default(0),
            house: z.number().int().min(0).default(0),
            other: z.number().int().min(0).default(0)
        })
        .optional(),

    // Price range statistics
    priceRange: z
        .object({
            min: z.number().min(0),
            max: z.number().min(0),
            average: z.number().min(0),
            currency: z.string()
        })
        .optional(),

    // Seasonal statistics
    popularityByMonth: z
        .array(
            z.object({
                month: z.number().int().min(1).max(12),
                bookings: z.number().int().min(0),
                views: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationFilters = z.infer<typeof DestinationFiltersSchema>;
export type DestinationListInput = z.infer<typeof DestinationListInputSchema>;
export type DestinationListItem = z.infer<typeof DestinationListItemSchema>;
export type DestinationListOutput = z.infer<typeof DestinationListOutputSchema>;
export type DestinationSearchInput = z.infer<typeof DestinationSearchInputSchema>;
export type DestinationSearchResult = z.infer<typeof DestinationSearchResultSchema>;
export type DestinationSearchOutput = z.infer<typeof DestinationSearchOutputSchema>;
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;
export type DestinationStats = z.infer<typeof DestinationStatsSchema>;
