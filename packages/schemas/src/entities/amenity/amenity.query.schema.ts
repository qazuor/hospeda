import { z } from 'zod';
import { AccommodationIdSchema, AmenityIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { AccommodationSummarySchema } from '../accommodation/accommodation.query.schema.js';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Amenity Query Schemas
 *
 * This file contains all schemas related to querying amenities:
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
 * Schema for amenity-specific filters
 * Used in list and search operations
 */
export const AmenityFiltersSchema = z.object({
    // Category filters
    category: z
        .string({
            message: 'zodError.amenity.filters.category.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.category.min' })
        .max(100, { message: 'zodError.amenity.filters.category.max' })
        .optional(),

    categories: z
        .array(
            z.string({
                message: 'zodError.amenity.filters.categories.item.invalidType'
            })
        )
        .optional(),

    // Icon filters
    icon: z
        .string({
            message: 'zodError.amenity.filters.icon.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.icon.min' })
        .max(100, { message: 'zodError.amenity.filters.icon.max' })
        .optional(),

    hasIcon: z
        .boolean({
            message: 'zodError.amenity.filters.hasIcon.invalidType'
        })
        .optional(),

    // Usage filters
    minUsageCount: z
        .number({
            message: 'zodError.amenity.filters.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.amenity.filters.minUsageCount.int' })
        .min(0, { message: 'zodError.amenity.filters.minUsageCount.min' })
        .optional(),

    maxUsageCount: z
        .number({
            message: 'zodError.amenity.filters.maxUsageCount.invalidType'
        })
        .int({ message: 'zodError.amenity.filters.maxUsageCount.int' })
        .min(0, { message: 'zodError.amenity.filters.maxUsageCount.min' })
        .optional(),

    isUnused: z
        .boolean({
            message: 'zodError.amenity.filters.isUnused.invalidType'
        })
        .optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.amenity.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.amenity.filters.createdBefore.invalidType'
        })
        .optional(),

    // Name pattern filters
    nameStartsWith: z
        .string({
            message: 'zodError.amenity.filters.nameStartsWith.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.nameStartsWith.min' })
        .max(50, { message: 'zodError.amenity.filters.nameStartsWith.max' })
        .optional(),

    nameEndsWith: z
        .string({
            message: 'zodError.amenity.filters.nameEndsWith.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.nameEndsWith.min' })
        .max(50, { message: 'zodError.amenity.filters.nameEndsWith.max' })
        .optional(),

    nameContains: z
        .string({
            message: 'zodError.amenity.filters.nameContains.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.nameContains.min' })
        .max(50, { message: 'zodError.amenity.filters.nameContains.max' })
        .optional(),

    // Description filters
    hasDescription: z
        .boolean({
            message: 'zodError.amenity.filters.hasDescription.invalidType'
        })
        .optional(),

    descriptionContains: z
        .string({
            message: 'zodError.amenity.filters.descriptionContains.invalidType'
        })
        .min(1, { message: 'zodError.amenity.filters.descriptionContains.min' })
        .max(100, { message: 'zodError.amenity.filters.descriptionContains.max' })
        .optional(),

    // Popularity filters
    isPopular: z
        .boolean({
            message: 'zodError.amenity.filters.isPopular.invalidType'
        })
        .optional(),

    popularityThreshold: z
        .number({
            message: 'zodError.amenity.filters.popularityThreshold.invalidType'
        })
        .int({ message: 'zodError.amenity.filters.popularityThreshold.int' })
        .min(1, { message: 'zodError.amenity.filters.popularityThreshold.min' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for amenity list input parameters
 * Includes pagination and filters
 */
export const AmenityListInputSchema = PaginationSchema.extend({
    filters: AmenityFiltersSchema.optional(),
    sortBy: z
        .enum(['name', 'category', 'usageCount', 'createdAt'], {
            message: 'zodError.amenity.list.sortBy.enum'
        })
        .optional()
        .default('name'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.amenity.list.sortOrder.enum'
        })
        .optional()
        .default('asc'),
    groupByCategory: z
        .boolean({
            message: 'zodError.amenity.list.groupByCategory.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual amenity items in lists
 * Contains essential fields for list display
 */
export const AmenityListItemSchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    category: true,
    icon: true,
    usageCount: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for amenity list output
 * Uses generic paginated response with list items
 */
export const AmenityListOutputSchema = z.object({
    items: z.array(AmenityListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    groupedByCategory: z.record(z.string(), z.array(AmenityListItemSchema)).optional()
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for amenity search input parameters
 * Extends base search with amenity-specific filters
 */
export const AmenitySearchInputSchema = BaseSearchSchema.extend({
    filters: AmenityFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.amenity.search.query.invalidType'
        })
        .min(1, { message: 'zodError.amenity.search.query.min' })
        .max(100, { message: 'zodError.amenity.search.query.max' })
        .optional(),
    searchInDescription: z
        .boolean({
            message: 'zodError.amenity.search.searchInDescription.invalidType'
        })
        .optional()
        .default(true),
    fuzzySearch: z
        .boolean({
            message: 'zodError.amenity.search.fuzzySearch.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for individual amenity search results
 * Extends list item with search score
 */
export const AmenitySearchResultSchema = AmenityListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.amenity.search.score.invalidType'
        })
        .min(0, { message: 'zodError.amenity.search.score.min' })
        .max(1, { message: 'zodError.amenity.search.score.max' })
        .optional(),
    matchedFields: z.array(z.enum(['name', 'description', 'category'])).optional()
});

/**
 * Schema for amenity search output
 * Uses generic paginated response with search results
 */
export const AmenitySearchOutputSchema = z.object({
    items: z.array(AmenitySearchResultSchema),
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
            totalResults: z.number().min(0),
            fuzzySearchUsed: z.boolean().optional(),
            searchedInDescription: z.boolean().optional()
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for amenity summary
 * Contains essential information for quick display
 */
export const AmenitySummarySchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    category: true,
    icon: true,
    usageCount: true
});

// ============================================================================
// CATEGORIES SCHEMA
// ============================================================================

/**
 * Schema for amenity categories input
 * Parameters for fetching amenity categories
 */
export const AmenityCategoriesInputSchema = z.object({
    includeUsageCount: z
        .boolean({
            message: 'zodError.amenity.categories.includeUsageCount.invalidType'
        })
        .optional()
        .default(true),
    minUsageCount: z
        .number({
            message: 'zodError.amenity.categories.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.amenity.categories.minUsageCount.int' })
        .min(0, { message: 'zodError.amenity.categories.minUsageCount.min' })
        .optional()
        .default(0),
    sortBy: z
        .enum(['name', 'usageCount', 'amenityCount'], {
            message: 'zodError.amenity.categories.sortBy.enum'
        })
        .optional()
        .default('name')
});

/**
 * Schema for amenity categories output
 * Returns list of categories with statistics
 */
export const AmenityCategoriesOutputSchema = z.object({
    categories: z.array(
        z.object({
            name: z.string(),
            amenityCount: z.number().int().min(0),
            totalUsageCount: z.number().int().min(0),
            averageUsagePerAmenity: z.number().min(0),
            mostUsedAmenity: z
                .object({
                    id: z.string().uuid(),
                    name: z.string(),
                    usageCount: z.number().int().min(0)
                })
                .optional()
        })
    ),
    metadata: z.object({
        totalCategories: z.number().int().min(0),
        totalAmenities: z.number().int().min(0),
        generatedAt: z.date()
    })
});

// ============================================================================
// POPULAR AMENITIES SCHEMA
// ============================================================================

/**
 * Schema for popular amenities input
 * Parameters for fetching popular amenities
 */
export const PopularAmenitiesInputSchema = z.object({
    limit: z
        .number({
            message: 'zodError.amenity.popular.limit.invalidType'
        })
        .int({ message: 'zodError.amenity.popular.limit.int' })
        .min(1, { message: 'zodError.amenity.popular.limit.min' })
        .max(100, { message: 'zodError.amenity.popular.limit.max' })
        .optional()
        .default(20),
    category: z
        .string({
            message: 'zodError.amenity.popular.category.invalidType'
        })
        .optional(),
    timeframe: z
        .enum(['all', 'year', 'month', 'week'], {
            message: 'zodError.amenity.popular.timeframe.enum'
        })
        .optional()
        .default('all')
});

/**
 * Schema for popular amenities output
 * Returns list of popular amenities with usage statistics
 */
export const PopularAmenitiesOutputSchema = z.object({
    amenities: z.array(
        AmenitySummarySchema.extend({
            recentUsageCount: z.number().int().min(0).optional(),
            growthRate: z.number().optional(),
            popularityRank: z.number().int().min(1)
        })
    ),
    metadata: z.object({
        category: z.string().optional(),
        timeframe: z.string(),
        totalAmenities: z.number().int().min(0),
        generatedAt: z.date()
    })
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for amenity statistics
 * Contains metrics and analytics data
 */
export const AmenityStatsSchema = z.object({
    // Basic statistics
    totalAmenities: z
        .number({
            message: 'zodError.amenity.stats.totalAmenities.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.totalAmenities.int' })
        .min(0, { message: 'zodError.amenity.stats.totalAmenities.min' })
        .default(0),

    unusedAmenities: z
        .number({
            message: 'zodError.amenity.stats.unusedAmenities.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.unusedAmenities.int' })
        .min(0, { message: 'zodError.amenity.stats.unusedAmenities.min' })
        .default(0),

    totalUsages: z
        .number({
            message: 'zodError.amenity.stats.totalUsages.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.totalUsages.int' })
        .min(0, { message: 'zodError.amenity.stats.totalUsages.min' })
        .default(0),

    averageUsagePerAmenity: z
        .number({
            message: 'zodError.amenity.stats.averageUsagePerAmenity.invalidType'
        })
        .min(0, { message: 'zodError.amenity.stats.averageUsagePerAmenity.min' })
        .default(0),

    // Category distribution
    categoryDistribution: z
        .array(
            z.object({
                category: z.string(),
                count: z.number().int().min(0),
                totalUsage: z.number().int().min(0)
            })
        )
        .optional(),

    totalCategories: z
        .number({
            message: 'zodError.amenity.stats.totalCategories.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.totalCategories.int' })
        .min(0, { message: 'zodError.amenity.stats.totalCategories.min' })
        .default(0),

    // Popular amenities
    mostUsedAmenities: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                category: z.string(),
                usageCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Recent activity
    amenitiesCreatedToday: z
        .number({
            message: 'zodError.amenity.stats.amenitiesCreatedToday.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesCreatedToday.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesCreatedToday.min' })
        .default(0),

    amenitiesCreatedThisWeek: z
        .number({
            message: 'zodError.amenity.stats.amenitiesCreatedThisWeek.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesCreatedThisWeek.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesCreatedThisWeek.min' })
        .default(0),

    amenitiesCreatedThisMonth: z
        .number({
            message: 'zodError.amenity.stats.amenitiesCreatedThisMonth.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesCreatedThisMonth.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesCreatedThisMonth.min' })
        .default(0),

    // Icon statistics
    amenitiesWithIcons: z
        .number({
            message: 'zodError.amenity.stats.amenitiesWithIcons.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesWithIcons.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesWithIcons.min' })
        .default(0),

    amenitiesWithoutIcons: z
        .number({
            message: 'zodError.amenity.stats.amenitiesWithoutIcons.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesWithoutIcons.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesWithoutIcons.min' })
        .default(0),

    // Description statistics
    amenitiesWithDescription: z
        .number({
            message: 'zodError.amenity.stats.amenitiesWithDescription.invalidType'
        })
        .int({ message: 'zodError.amenity.stats.amenitiesWithDescription.int' })
        .min(0, { message: 'zodError.amenity.stats.amenitiesWithDescription.min' })
        .default(0),

    averageDescriptionLength: z
        .number({
            message: 'zodError.amenity.stats.averageDescriptionLength.invalidType'
        })
        .min(0, { message: 'zodError.amenity.stats.averageDescriptionLength.min' })
        .default(0)
});

// ============================================================================
// ACCOMMODATION-AMENITY QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting accommodations by amenity input
 * Parameters for finding all accommodations that have a specific amenity
 * Uses branded AmenityIdSchema for type safety
 */
export const AmenityGetAccommodationsInputSchema = z.object({
    amenityId: AmenityIdSchema
});

/**
 * Schema for getting amenities for accommodation input
 * Parameters for finding all amenities of a specific accommodation
 * Uses branded AccommodationIdSchema for type safety
 */
export const AmenityGetForAccommodationInputSchema = z.object({
    accommodationId: AccommodationIdSchema
});

/**
 * Schema for amenity list with usage count
 * Used for searchForList method that includes accommodation counts
 */
export const AmenityListWithUsageCountSchema = AmenitySchema.extend({
    accommodationCount: z
        .number({
            message: 'zodError.amenity.listWithUsage.accommodationCount.invalidType'
        })
        .int({ message: 'zodError.amenity.listWithUsage.accommodationCount.int' })
        .min(0, { message: 'zodError.amenity.listWithUsage.accommodationCount.min' })
        .optional()
});

/**
 * Schema for amenity search for list output
 * Returns amenities with accommodation counts and pagination
 */
export const AmenitySearchForListOutputSchema = z.object({
    items: z.array(AmenityListWithUsageCountSchema),
    total: z
        .number({
            message: 'zodError.amenity.searchForList.total.invalidType'
        })
        .int({ message: 'zodError.amenity.searchForList.total.int' })
        .min(0, { message: 'zodError.amenity.searchForList.total.min' })
});

/**
 * Schema for accommodations output
 * Used when returning lists of accommodations
 * Uses AccommodationSummarySchema for proper typing
 */
export const AmenityAccommodationsOutputSchema = z.object({
    accommodations: z.array(AccommodationSummarySchema)
});

/**
 * Schema for amenities output
 * Used when returning lists of amenities
 */
export const AmenityArrayOutputSchema = z.object({
    amenities: z.array(AmenitySchema)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AmenityFilters = z.infer<typeof AmenityFiltersSchema>;
export type AmenityListInput = z.infer<typeof AmenityListInputSchema>;
export type AmenityListItem = z.infer<typeof AmenityListItemSchema>;
export type AmenityListOutput = z.infer<typeof AmenityListOutputSchema>;
export type AmenitySearchInput = z.infer<typeof AmenitySearchInputSchema>;
export type AmenitySearchResult = z.infer<typeof AmenitySearchResultSchema>;
export type AmenitySearchOutput = z.infer<typeof AmenitySearchOutputSchema>;
export type AmenitySummary = z.infer<typeof AmenitySummarySchema>;
export type AmenityCategoriesInput = z.infer<typeof AmenityCategoriesInputSchema>;
export type AmenityCategoriesOutput = z.infer<typeof AmenityCategoriesOutputSchema>;
export type PopularAmenitiesInput = z.infer<typeof PopularAmenitiesInputSchema>;
export type PopularAmenitiesOutput = z.infer<typeof PopularAmenitiesOutputSchema>;
export type AmenityStats = z.infer<typeof AmenityStatsSchema>;
export type AmenityGetAccommodationsInput = z.infer<typeof AmenityGetAccommodationsInputSchema>;
export type AmenityGetForAccommodationInput = z.infer<typeof AmenityGetForAccommodationInputSchema>;
export type AmenityListWithUsageCount = z.infer<typeof AmenityListWithUsageCountSchema>;
export type AmenitySearchForListOutput = z.infer<typeof AmenitySearchForListOutputSchema>;
export type AmenityAccommodationsOutput = z.infer<typeof AmenityAccommodationsOutputSchema>;
export type AmenityArrayOutput = z.infer<typeof AmenityArrayOutputSchema>;
