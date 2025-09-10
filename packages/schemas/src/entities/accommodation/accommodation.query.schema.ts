import { z } from 'zod';
import {
    IdOrSlugParamsSchema,
    WithDestinationIdParamsSchema,
    WithLimitParamsSchema
} from '../../common/params.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation Query Schemas
 *
 * This file contains all schemas related to querying accommodations:
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
 * Schema for accommodation-specific filters
 * Used in list and search operations
 */
export const AccommodationFiltersSchema = z.object({
    // Basic filters
    type: AccommodationTypeEnumSchema.optional(),
    isFeatured: z
        .boolean({
            message: 'zodError.accommodation.filters.isFeatured.invalidType'
        })
        .optional(),

    // Price range filters
    minPrice: z
        .number({
            message: 'zodError.accommodation.filters.minPrice.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.filters.minPrice.min' })
        .optional(),

    maxPrice: z
        .number({
            message: 'zodError.accommodation.filters.maxPrice.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.filters.maxPrice.min' })
        .optional(),

    currency: PriceCurrencyEnumSchema.optional(),

    // Location filters
    destinationId: z
        .string({
            message: 'zodError.accommodation.filters.destinationId.invalidType'
        })
        .uuid({ message: 'zodError.accommodation.filters.destinationId.uuid' })
        .optional(),

    // Location radius search
    latitude: z
        .number({
            message: 'zodError.accommodation.filters.latitude.invalidType'
        })
        .min(-90, { message: 'zodError.accommodation.filters.latitude.min' })
        .max(90, { message: 'zodError.accommodation.filters.latitude.max' })
        .optional(),

    longitude: z
        .number({
            message: 'zodError.accommodation.filters.longitude.invalidType'
        })
        .min(-180, { message: 'zodError.accommodation.filters.longitude.min' })
        .max(180, { message: 'zodError.accommodation.filters.longitude.max' })
        .optional(),

    radius: z
        .number({
            message: 'zodError.accommodation.filters.radius.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.filters.radius.min' })
        .max(1000, { message: 'zodError.accommodation.filters.radius.max' })
        .optional(),

    // Owner filter
    ownerId: z
        .string({
            message: 'zodError.accommodation.filters.ownerId.invalidType'
        })
        .uuid({ message: 'zodError.accommodation.filters.ownerId.uuid' })
        .optional(),

    // Rating filter
    minRating: z
        .number({
            message: 'zodError.accommodation.filters.minRating.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.filters.minRating.min' })
        .max(5, { message: 'zodError.accommodation.filters.minRating.max' })
        .optional(),

    // Amenities and features (array of IDs)
    amenities: z
        .array(z.string().uuid({ message: 'zodError.accommodation.filters.amenities.item.uuid' }))
        .optional(),

    features: z
        .array(z.string().uuid({ message: 'zodError.accommodation.filters.features.item.uuid' }))
        .optional(),

    // Tags filter
    tags: z
        .array(z.string().uuid({ message: 'zodError.accommodation.filters.tags.item.uuid' }))
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for accommodation list input parameters
 * Includes pagination and filters
 */
export const AccommodationListInputSchema = PaginationSchema.extend({
    filters: AccommodationFiltersSchema.optional()
});

/**
 * Schema for individual accommodation items in lists
 * Contains essential fields for list display
 */
export const AccommodationListItemSchema = AccommodationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    type: true,
    isFeatured: true,
    location: true,
    media: true,
    rating: true,
    price: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for accommodation list output
 * Uses generic paginated response with list items
 */
export const AccommodationListOutputSchema = z.object({
    items: z.array(AccommodationListItemSchema),
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
 * Schema for accommodation search input parameters
 * Extends base search with accommodation-specific filters
 */
export const AccommodationSearchInputSchema = BaseSearchSchema.extend({
    filters: AccommodationFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.accommodation.search.query.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.search.query.min' })
        .max(100, { message: 'zodError.accommodation.search.query.max' })
        .optional()
});

/**
 * Schema for individual accommodation search results
 * Extends list item with search score
 */
export const AccommodationSearchResultSchema = AccommodationListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.accommodation.search.score.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.search.score.min' })
        .max(1, { message: 'zodError.accommodation.search.score.max' })
        .optional()
});

/**
 * Schema for accommodation search output
 * Uses generic paginated response with search results
 */
export const AccommodationSearchOutputSchema = z.object({
    items: z.array(AccommodationSearchResultSchema),
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
 * Schema for accommodation summary
 * Contains essential information for quick display
 */
export const AccommodationSummarySchema = AccommodationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    type: true,
    isFeatured: true,
    rating: true,
    location: true,
    media: true,
    price: true
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for accommodation statistics
 * Contains metrics and analytics data
 */
export const AccommodationStatsSchema = z.object({
    // Review statistics
    reviewsCount: z
        .number({
            message: 'zodError.accommodation.stats.reviewsCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.reviewsCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.reviewsCount.min' })
        .default(0),

    averageRating: z
        .number({
            message: 'zodError.accommodation.stats.averageRating.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.stats.averageRating.min' })
        .max(5, { message: 'zodError.accommodation.stats.averageRating.max' })
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

    // Booking statistics (if applicable)
    bookingsCount: z
        .number({
            message: 'zodError.accommodation.stats.bookingsCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.bookingsCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.bookingsCount.min' })
        .default(0),

    // View statistics
    viewsCount: z
        .number({
            message: 'zodError.accommodation.stats.viewsCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.viewsCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.viewsCount.min' })
        .default(0),

    // Favorites/bookmarks
    favoritesCount: z
        .number({
            message: 'zodError.accommodation.stats.favoritesCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.favoritesCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.favoritesCount.min' })
        .default(0),

    // Content statistics
    photosCount: z
        .number({
            message: 'zodError.accommodation.stats.photosCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.photosCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.photosCount.min' })
        .default(0),

    amenitiesCount: z
        .number({
            message: 'zodError.accommodation.stats.amenitiesCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.amenitiesCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.amenitiesCount.min' })
        .default(0),

    featuresCount: z
        .number({
            message: 'zodError.accommodation.stats.featuresCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.featuresCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.featuresCount.min' })
        .default(0),

    faqsCount: z
        .number({
            message: 'zodError.accommodation.stats.faqsCount.invalidType'
        })
        .int({ message: 'zodError.accommodation.stats.faqsCount.int' })
        .min(0, { message: 'zodError.accommodation.stats.faqsCount.min' })
        .default(0)
});

// ==========================================================================
// PARAM SCHEMAS FOR SERVICE METHODS (INPUTS)
// ==========================================================================

/**
 * Params for accommodation summary endpoints (id or slug)
 */
export const AccommodationSummaryParamsSchema = IdOrSlugParamsSchema;

/**
 * Params for accommodation stats endpoints (id or slug)
 */
export const AccommodationStatsParamsSchema = IdOrSlugParamsSchema;

/**
 * Params for top-rated accommodations
 * Combines generic params with accommodation-specific filters
 */
export const AccommodationTopRatedParamsSchema = WithLimitParamsSchema.merge(
    z.object({
        destinationId: WithDestinationIdParamsSchema.shape.destinationId.optional(),
        type: AccommodationTypeEnumSchema.optional(),
        onlyFeatured: z
            .boolean({
                message: 'zodError.accommodation.topRated.onlyFeatured.invalidType'
            })
            .optional()
    })
);

/**
 * Params for accommodations by destination
 */
export const AccommodationByDestinationParamsSchema = WithDestinationIdParamsSchema;

// ==========================================================================
// NORMALIZED/LIST OUTPUT SCHEMAS
// ==========================================================================

/**
 * Minimal destination relation for list/search outputs
 */
export const DestinationMiniSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string()
});

/**
 * Minimal owner relation for list/search outputs
 */
export const UserMiniSchema = z.object({
    id: z.string().uuid(),
    displayName: z.string().optional()
});

/**
 * Normalized accommodation output schema used by list/top endpoints
 */
export const AccommodationNormalizedSchema = AccommodationSchema.extend({
    amenities: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    destination: DestinationMiniSchema.optional()
});

/**
 * Output schema for top-rated accommodations
 */
export const AccommodationTopRatedOutputSchema = z.array(AccommodationNormalizedSchema);

/**
 * Output schema for accommodations by destination
 */
export const AccommodationByDestinationOutputSchema = z.array(AccommodationNormalizedSchema);

/**
 * Output schema for list with total (searchForList)
 */
export const AccommodationListItemWithMiniRelationsSchema = AccommodationListItemSchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserMiniSchema.optional()
});

export const AccommodationListWithTotalOutputSchema = z.object({
    items: z.array(AccommodationListItemWithMiniRelationsSchema),
    total: z.number().min(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationFilters = z.infer<typeof AccommodationFiltersSchema>;
export type AccommodationListInput = z.infer<typeof AccommodationListInputSchema>;
export type AccommodationListItem = z.infer<typeof AccommodationListItemSchema>;
export type AccommodationListOutput = z.infer<typeof AccommodationListOutputSchema>;
export type AccommodationSearchInput = z.infer<typeof AccommodationSearchInputSchema>;
export type AccommodationSearchResult = z.infer<typeof AccommodationSearchResultSchema>;
export type AccommodationSearchOutput = z.infer<typeof AccommodationSearchOutputSchema>;
export type AccommodationSummary = z.infer<typeof AccommodationSummarySchema>;
export type AccommodationStats = z.infer<typeof AccommodationStatsSchema>;
export type AccommodationSummaryParams = z.infer<typeof AccommodationSummaryParamsSchema>;
export type AccommodationStatsParams = z.infer<typeof AccommodationStatsParamsSchema>;
export type AccommodationTopRatedParams = z.infer<typeof AccommodationTopRatedParamsSchema>;
export type AccommodationByDestinationParams = z.infer<
    typeof AccommodationByDestinationParamsSchema
>;
export type AccommodationNormalized = z.infer<typeof AccommodationNormalizedSchema>;
export type AccommodationTopRatedOutput = z.infer<typeof AccommodationTopRatedOutputSchema>;
export type AccommodationByDestinationOutput = z.infer<
    typeof AccommodationByDestinationOutputSchema
>;
export type AccommodationListItemWithMiniRelations = z.infer<
    typeof AccommodationListItemWithMiniRelationsSchema
>;
export type AccommodationListWithTotalOutput = z.infer<
    typeof AccommodationListWithTotalOutputSchema
>;

/**
 * Accommodation Stats Output Schema
 *
 * Schema for accommodation statistics including reviews count, average rating, and detailed rating breakdown.
 * Used by the getStats method to return statistical information about an accommodation.
 */
export const AccommodationStatsOutputSchema = z
    .object({
        reviewsCount: z.number().int().min(0),
        averageRating: z.number().min(0).max(5),
        rating: z
            .object({
                cleanliness: z.number().min(0).max(5),
                hospitality: z.number().min(0).max(5),
                services: z.number().min(0).max(5),
                accuracy: z.number().min(0).max(5),
                communication: z.number().min(0).max(5)
            })
            .optional()
    })
    .nullable();

export type AccommodationStatsOutput = z.infer<typeof AccommodationStatsOutputSchema>;
