import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { FeatureSchema } from './feature.schema.js';

/**
 * Feature Query Schemas
 *
 * This file contains all schemas related to querying features:
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
 * Schema for feature-specific filters
 * Used in list and search operations
 */
export const FeatureFiltersSchema = z.object({
    // Category filters
    category: z
        .string({
            message: 'zodError.feature.filters.category.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.category.min' })
        .max(100, { message: 'zodError.feature.filters.category.max' })
        .optional(),

    categories: z
        .array(
            z.string({
                message: 'zodError.feature.filters.categories.item.invalidType'
            })
        )
        .optional(),

    // Icon filters
    icon: z
        .string({
            message: 'zodError.feature.filters.icon.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.icon.min' })
        .max(100, { message: 'zodError.feature.filters.icon.max' })
        .optional(),

    hasIcon: z
        .boolean({
            message: 'zodError.feature.filters.hasIcon.invalidType'
        })
        .optional(),

    // Availability filters
    isAvailable: z
        .boolean({
            message: 'zodError.feature.filters.isAvailable.invalidType'
        })
        .optional(),

    // Priority filters
    minPriority: z
        .number({
            message: 'zodError.feature.filters.minPriority.invalidType'
        })
        .int({ message: 'zodError.feature.filters.minPriority.int' })
        .min(0, { message: 'zodError.feature.filters.minPriority.min' })
        .max(100, { message: 'zodError.feature.filters.minPriority.max' })
        .optional(),

    maxPriority: z
        .number({
            message: 'zodError.feature.filters.maxPriority.invalidType'
        })
        .int({ message: 'zodError.feature.filters.maxPriority.int' })
        .min(0, { message: 'zodError.feature.filters.maxPriority.min' })
        .max(100, { message: 'zodError.feature.filters.maxPriority.max' })
        .optional(),

    // Usage filters
    minUsageCount: z
        .number({
            message: 'zodError.feature.filters.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.feature.filters.minUsageCount.int' })
        .min(0, { message: 'zodError.feature.filters.minUsageCount.min' })
        .optional(),

    maxUsageCount: z
        .number({
            message: 'zodError.feature.filters.maxUsageCount.invalidType'
        })
        .int({ message: 'zodError.feature.filters.maxUsageCount.int' })
        .min(0, { message: 'zodError.feature.filters.maxUsageCount.min' })
        .optional(),

    isUnused: z
        .boolean({
            message: 'zodError.feature.filters.isUnused.invalidType'
        })
        .optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.feature.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.feature.filters.createdBefore.invalidType'
        })
        .optional(),

    // Name pattern filters
    nameStartsWith: z
        .string({
            message: 'zodError.feature.filters.nameStartsWith.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.nameStartsWith.min' })
        .max(50, { message: 'zodError.feature.filters.nameStartsWith.max' })
        .optional(),

    nameEndsWith: z
        .string({
            message: 'zodError.feature.filters.nameEndsWith.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.nameEndsWith.min' })
        .max(50, { message: 'zodError.feature.filters.nameEndsWith.max' })
        .optional(),

    nameContains: z
        .string({
            message: 'zodError.feature.filters.nameContains.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.nameContains.min' })
        .max(50, { message: 'zodError.feature.filters.nameContains.max' })
        .optional(),

    // Description filters
    hasDescription: z
        .boolean({
            message: 'zodError.feature.filters.hasDescription.invalidType'
        })
        .optional(),

    descriptionContains: z
        .string({
            message: 'zodError.feature.filters.descriptionContains.invalidType'
        })
        .min(1, { message: 'zodError.feature.filters.descriptionContains.min' })
        .max(100, { message: 'zodError.feature.filters.descriptionContains.max' })
        .optional(),

    // Popularity filters
    isPopular: z
        .boolean({
            message: 'zodError.feature.filters.isPopular.invalidType'
        })
        .optional(),

    popularityThreshold: z
        .number({
            message: 'zodError.feature.filters.popularityThreshold.invalidType'
        })
        .int({ message: 'zodError.feature.filters.popularityThreshold.int' })
        .min(1, { message: 'zodError.feature.filters.popularityThreshold.min' })
        .optional(),

    // Premium/paid filters
    isPremium: z
        .boolean({
            message: 'zodError.feature.filters.isPremium.invalidType'
        })
        .optional(),

    requiresPayment: z
        .boolean({
            message: 'zodError.feature.filters.requiresPayment.invalidType'
        })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for feature list input parameters
 * Includes pagination and filters
 */
export const FeatureListInputSchema = PaginationSchema.extend({
    filters: FeatureFiltersSchema.optional(),
    sortBy: z
        .enum(['name', 'category', 'priority', 'usageCount', 'createdAt'], {
            message: 'zodError.feature.list.sortBy.enum'
        })
        .optional()
        .default('name'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.feature.list.sortOrder.enum'
        })
        .optional()
        .default('asc'),
    groupByCategory: z
        .boolean({
            message: 'zodError.feature.list.groupByCategory.invalidType'
        })
        .optional()
        .default(false),
    groupByAvailability: z
        .boolean({
            message: 'zodError.feature.list.groupByAvailability.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual feature items in lists
 * Contains essential fields for list display
 */
export const FeatureListItemSchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for feature list output
 * Uses generic paginated response with list items
 */
export const FeatureListOutputSchema = z.object({
    items: z.array(FeatureListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    groupedByCategory: z.record(z.string(), z.array(FeatureListItemSchema)).optional(),
    groupedByAvailability: z
        .object({
            available: z.array(FeatureListItemSchema),
            unavailable: z.array(FeatureListItemSchema)
        })
        .optional()
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for feature search input parameters
 * Extends base search with feature-specific filters
 */
export const FeatureSearchInputSchema = BaseSearchSchema.extend({
    filters: FeatureFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.feature.search.query.invalidType'
        })
        .min(1, { message: 'zodError.feature.search.query.min' })
        .max(100, { message: 'zodError.feature.search.query.max' })
        .optional(),
    searchInDescription: z
        .boolean({
            message: 'zodError.feature.search.searchInDescription.invalidType'
        })
        .optional()
        .default(true),
    fuzzySearch: z
        .boolean({
            message: 'zodError.feature.search.fuzzySearch.invalidType'
        })
        .optional()
        .default(true),
    includeUnavailable: z
        .boolean({
            message: 'zodError.feature.search.includeUnavailable.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual feature search results
 * Extends list item with search score
 */
export const FeatureSearchResultSchema = FeatureListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.feature.search.score.invalidType'
        })
        .min(0, { message: 'zodError.feature.search.score.min' })
        .max(1, { message: 'zodError.feature.search.score.max' })
        .optional(),
    matchedFields: z.array(z.enum(['name', 'description', 'category'])).optional()
});

/**
 * Schema for feature search output
 * Uses generic paginated response with search results
 */
export const FeatureSearchOutputSchema = z.object({
    items: z.array(FeatureSearchResultSchema),
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
            searchedInDescription: z.boolean().optional(),
            includedUnavailable: z.boolean().optional()
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for feature summary
 * Contains essential information for quick display
 */
export const FeatureSummarySchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true
});

// ============================================================================
// CATEGORIES SCHEMA
// ============================================================================

/**
 * Schema for feature categories input
 * Parameters for fetching feature categories
 */
export const FeatureCategoriesInputSchema = z.object({
    includeUsageCount: z
        .boolean({
            message: 'zodError.feature.categories.includeUsageCount.invalidType'
        })
        .optional()
        .default(true),
    minUsageCount: z
        .number({
            message: 'zodError.feature.categories.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.feature.categories.minUsageCount.int' })
        .min(0, { message: 'zodError.feature.categories.minUsageCount.min' })
        .optional()
        .default(0),
    includeUnavailable: z
        .boolean({
            message: 'zodError.feature.categories.includeUnavailable.invalidType'
        })
        .optional()
        .default(true),
    sortBy: z
        .enum(['name', 'usageCount', 'featureCount', 'averagePriority'], {
            message: 'zodError.feature.categories.sortBy.enum'
        })
        .optional()
        .default('name')
});

/**
 * Schema for feature categories output
 * Returns list of categories with statistics
 */
export const FeatureCategoriesOutputSchema = z.object({
    categories: z.array(
        z.object({
            name: z.string(),
            featureCount: z.number().int().min(0),
            availableFeatureCount: z.number().int().min(0),
            totalUsageCount: z.number().int().min(0),
            averageUsagePerFeature: z.number().min(0),
            averagePriority: z.number().min(0).max(100),
            mostUsedFeature: z
                .object({
                    id: z.string().uuid(),
                    name: z.string(),
                    usageCount: z.number().int().min(0)
                })
                .optional(),
            highestPriorityFeature: z
                .object({
                    id: z.string().uuid(),
                    name: z.string(),
                    priority: z.number().int().min(0).max(100)
                })
                .optional()
        })
    ),
    metadata: z.object({
        totalCategories: z.number().int().min(0),
        totalFeatures: z.number().int().min(0),
        totalAvailableFeatures: z.number().int().min(0),
        generatedAt: z.date()
    })
});

// ============================================================================
// POPULAR FEATURES SCHEMA
// ============================================================================

/**
 * Schema for popular features input
 * Parameters for fetching popular features
 */
export const PopularFeaturesInputSchema = z.object({
    limit: z
        .number({
            message: 'zodError.feature.popular.limit.invalidType'
        })
        .int({ message: 'zodError.feature.popular.limit.int' })
        .min(1, { message: 'zodError.feature.popular.limit.min' })
        .max(100, { message: 'zodError.feature.popular.limit.max' })
        .optional()
        .default(20),
    category: z
        .string({
            message: 'zodError.feature.popular.category.invalidType'
        })
        .optional(),
    timeframe: z
        .enum(['all', 'year', 'month', 'week'], {
            message: 'zodError.feature.popular.timeframe.enum'
        })
        .optional()
        .default('all'),
    onlyAvailable: z
        .boolean({
            message: 'zodError.feature.popular.onlyAvailable.invalidType'
        })
        .optional()
        .default(true),
    minPriority: z
        .number({
            message: 'zodError.feature.popular.minPriority.invalidType'
        })
        .int({ message: 'zodError.feature.popular.minPriority.int' })
        .min(0, { message: 'zodError.feature.popular.minPriority.min' })
        .max(100, { message: 'zodError.feature.popular.minPriority.max' })
        .optional()
});

/**
 * Schema for popular features output
 * Returns list of popular features with usage statistics
 */
export const PopularFeaturesOutputSchema = z.object({
    features: z.array(
        FeatureSummarySchema.extend({
            recentUsageCount: z.number().int().min(0).optional(),
            growthRate: z.number().optional(),
            popularityRank: z.number().int().min(1),
            availabilityScore: z.number().min(0).max(1).optional() // How often it's available vs requested
        })
    ),
    metadata: z.object({
        category: z.string().optional(),
        timeframe: z.string(),
        totalFeatures: z.number().int().min(0),
        onlyAvailable: z.boolean(),
        minPriority: z.number().int().min(0).max(100).optional(),
        generatedAt: z.date()
    })
});

// ============================================================================
// PRIORITY DISTRIBUTION SCHEMA
// ============================================================================

/**
 * Schema for feature priority distribution input
 * Parameters for analyzing priority distribution
 */
export const FeaturePriorityDistributionInputSchema = z.object({
    category: z
        .string({
            message: 'zodError.feature.priorityDistribution.category.invalidType'
        })
        .optional(),
    includeUnavailable: z
        .boolean({
            message: 'zodError.feature.priorityDistribution.includeUnavailable.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for feature priority distribution output
 * Returns priority distribution analysis
 */
export const FeaturePriorityDistributionOutputSchema = z.object({
    distribution: z.object({
        critical: z.number().int().min(0), // 90-100
        high: z.number().int().min(0), // 70-89
        medium: z.number().int().min(0), // 40-69
        low: z.number().int().min(0), // 10-39
        minimal: z.number().int().min(0) // 0-9
    }),
    statistics: z.object({
        totalFeatures: z.number().int().min(0),
        averagePriority: z.number().min(0).max(100),
        medianPriority: z.number().min(0).max(100),
        highestPriority: z.number().int().min(0).max(100),
        lowestPriority: z.number().int().min(0).max(100)
    }),
    topPriorityFeatures: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                category: z.string(),
                priority: z.number().int().min(0).max(100),
                usageCount: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for feature statistics
 * Contains metrics and analytics data
 */
export const FeatureStatsSchema = z.object({
    // Basic statistics
    totalFeatures: z
        .number({
            message: 'zodError.feature.stats.totalFeatures.invalidType'
        })
        .int({ message: 'zodError.feature.stats.totalFeatures.int' })
        .min(0, { message: 'zodError.feature.stats.totalFeatures.min' })
        .default(0),

    availableFeatures: z
        .number({
            message: 'zodError.feature.stats.availableFeatures.invalidType'
        })
        .int({ message: 'zodError.feature.stats.availableFeatures.int' })
        .min(0, { message: 'zodError.feature.stats.availableFeatures.min' })
        .default(0),

    unavailableFeatures: z
        .number({
            message: 'zodError.feature.stats.unavailableFeatures.invalidType'
        })
        .int({ message: 'zodError.feature.stats.unavailableFeatures.int' })
        .min(0, { message: 'zodError.feature.stats.unavailableFeatures.min' })
        .default(0),

    unusedFeatures: z
        .number({
            message: 'zodError.feature.stats.unusedFeatures.invalidType'
        })
        .int({ message: 'zodError.feature.stats.unusedFeatures.int' })
        .min(0, { message: 'zodError.feature.stats.unusedFeatures.min' })
        .default(0),

    totalUsages: z
        .number({
            message: 'zodError.feature.stats.totalUsages.invalidType'
        })
        .int({ message: 'zodError.feature.stats.totalUsages.int' })
        .min(0, { message: 'zodError.feature.stats.totalUsages.min' })
        .default(0),

    averageUsagePerFeature: z
        .number({
            message: 'zodError.feature.stats.averageUsagePerFeature.invalidType'
        })
        .min(0, { message: 'zodError.feature.stats.averageUsagePerFeature.min' })
        .default(0),

    // Priority statistics
    averagePriority: z
        .number({
            message: 'zodError.feature.stats.averagePriority.invalidType'
        })
        .min(0, { message: 'zodError.feature.stats.averagePriority.min' })
        .max(100, { message: 'zodError.feature.stats.averagePriority.max' })
        .default(0),

    priorityDistribution: z
        .object({
            critical: z.number().int().min(0).default(0),
            high: z.number().int().min(0).default(0),
            medium: z.number().int().min(0).default(0),
            low: z.number().int().min(0).default(0),
            minimal: z.number().int().min(0).default(0)
        })
        .optional(),

    // Category distribution
    categoryDistribution: z
        .array(
            z.object({
                category: z.string(),
                count: z.number().int().min(0),
                availableCount: z.number().int().min(0),
                totalUsage: z.number().int().min(0),
                averagePriority: z.number().min(0).max(100)
            })
        )
        .optional(),

    totalCategories: z
        .number({
            message: 'zodError.feature.stats.totalCategories.invalidType'
        })
        .int({ message: 'zodError.feature.stats.totalCategories.int' })
        .min(0, { message: 'zodError.feature.stats.totalCategories.min' })
        .default(0),

    // Popular features
    mostUsedFeatures: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                category: z.string(),
                usageCount: z.number().int().min(0),
                priority: z.number().int().min(0).max(100)
            })
        )
        .optional(),

    // Recent activity
    featuresCreatedToday: z
        .number({
            message: 'zodError.feature.stats.featuresCreatedToday.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresCreatedToday.int' })
        .min(0, { message: 'zodError.feature.stats.featuresCreatedToday.min' })
        .default(0),

    featuresCreatedThisWeek: z
        .number({
            message: 'zodError.feature.stats.featuresCreatedThisWeek.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresCreatedThisWeek.int' })
        .min(0, { message: 'zodError.feature.stats.featuresCreatedThisWeek.min' })
        .default(0),

    featuresCreatedThisMonth: z
        .number({
            message: 'zodError.feature.stats.featuresCreatedThisMonth.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresCreatedThisMonth.int' })
        .min(0, { message: 'zodError.feature.stats.featuresCreatedThisMonth.min' })
        .default(0),

    // Icon statistics
    featuresWithIcons: z
        .number({
            message: 'zodError.feature.stats.featuresWithIcons.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresWithIcons.int' })
        .min(0, { message: 'zodError.feature.stats.featuresWithIcons.min' })
        .default(0),

    featuresWithoutIcons: z
        .number({
            message: 'zodError.feature.stats.featuresWithoutIcons.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresWithoutIcons.int' })
        .min(0, { message: 'zodError.feature.stats.featuresWithoutIcons.min' })
        .default(0),

    // Description statistics
    featuresWithDescription: z
        .number({
            message: 'zodError.feature.stats.featuresWithDescription.invalidType'
        })
        .int({ message: 'zodError.feature.stats.featuresWithDescription.int' })
        .min(0, { message: 'zodError.feature.stats.featuresWithDescription.min' })
        .default(0),

    averageDescriptionLength: z
        .number({
            message: 'zodError.feature.stats.averageDescriptionLength.invalidType'
        })
        .min(0, { message: 'zodError.feature.stats.averageDescriptionLength.min' })
        .default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FeatureFilters = z.infer<typeof FeatureFiltersSchema>;
export type FeatureListInput = z.infer<typeof FeatureListInputSchema>;
export type FeatureListItem = z.infer<typeof FeatureListItemSchema>;
export type FeatureListOutput = z.infer<typeof FeatureListOutputSchema>;
export type FeatureSearchInput = z.infer<typeof FeatureSearchInputSchema>;
export type FeatureSearchResult = z.infer<typeof FeatureSearchResultSchema>;
export type FeatureSearchOutput = z.infer<typeof FeatureSearchOutputSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
export type FeatureCategoriesInput = z.infer<typeof FeatureCategoriesInputSchema>;
export type FeatureCategoriesOutput = z.infer<typeof FeatureCategoriesOutputSchema>;
export type PopularFeaturesInput = z.infer<typeof PopularFeaturesInputSchema>;
export type PopularFeaturesOutput = z.infer<typeof PopularFeaturesOutputSchema>;
export type FeaturePriorityDistributionInput = z.infer<
    typeof FeaturePriorityDistributionInputSchema
>;
export type FeaturePriorityDistributionOutput = z.infer<
    typeof FeaturePriorityDistributionOutputSchema
>;
export type FeatureStats = z.infer<typeof FeatureStatsSchema>;
