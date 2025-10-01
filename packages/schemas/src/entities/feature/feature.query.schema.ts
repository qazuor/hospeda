import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { FeatureSchema } from './feature.schema.js';

/**
 * Feature Query Schemas
 *
 * Standardized query schemas for feature operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for features
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Feature-specific filters that extend the base search functionality
 */
export const FeatureFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Availability filters
    isAvailable: z.boolean().optional(),
    hasIcon: z.boolean().optional(),
    hasDescription: z.boolean().optional(),

    // Priority filters
    minPriority: z.number().int().min(0).max(100).optional(),
    maxPriority: z.number().int().min(0).max(100).optional(),

    // Usage filters
    minUsageCount: z.number().int().min(0).optional(),
    maxUsageCount: z.number().int().min(0).optional(),
    isUnused: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Content pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),
    descriptionContains: z.string().min(1).max(100).optional(),

    // Popularity filters
    isPopular: z.boolean().optional(),
    popularityThreshold: z.number().int().min(1).optional(),

    // Premium/payment filters
    isPremium: z.boolean().optional(),
    requiresPayment: z.boolean().optional(),

    // Category grouping
    categories: z.array(z.string()).optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete feature search schema combining base search with feature-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: Feature-specific filtering options
 */
export const FeatureSearchSchema = BaseSearchSchema.extend({
    filters: FeatureFiltersSchema.optional(),

    // Feature-specific search options
    searchInDescription: z.boolean().default(true).optional(),
    fuzzySearch: z.boolean().default(true).optional(),
    includeUnavailable: z.boolean().default(false).optional(),
    groupByCategory: z.boolean().default(false).optional(),
    groupByAvailability: z.boolean().default(false).optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Feature list item schema - contains essential fields for list display
 */
export const FeatureListItemSchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    isBuiltin: true,
    isFeatured: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Feature search result item - extends list item with search relevance score
 */
export const FeatureSearchResultItemSchema = FeatureListItemSchema.extend({
    score: z.number().min(0).max(1).optional(),
    matchedFields: z.array(z.enum(['name', 'description', 'icon'])).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Feature list response using standardized pagination format
 */
export const FeatureListResponseSchema = PaginationResultSchema(FeatureListItemSchema);

/**
 * Feature search response using standardized pagination format with search results
 */
export const FeatureSearchResponseSchema = PaginationResultSchema(FeatureSearchResultItemSchema);

/**
 * Extended feature list response with grouping options
 */
export const FeatureListWithGroupingResponseSchema = FeatureListResponseSchema.extend({
    groupedByCategory: z.record(z.string(), z.array(FeatureListItemSchema)).optional(),
    groupedByAvailability: z
        .object({
            available: z.array(FeatureListItemSchema),
            unavailable: z.array(FeatureListItemSchema)
        })
        .optional()
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for feature categories input
 */
export const FeatureCategoriesSchema = z.object({
    includeUsageCount: z.boolean().default(true),
    minUsageCount: z.number().int().min(0).default(0),
    includeUnavailable: z.boolean().default(true),
    sortBy: z.enum(['name', 'usageCount', 'featureCount', 'averagePriority']).default('name')
});

/**
 * Schema for popular features input
 */
export const PopularFeaturesSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
    category: z.string().optional(),
    timeframe: z.enum(['all', 'year', 'month', 'week']).default('all'),
    onlyAvailable: z.boolean().default(true),
    minPriority: z.number().int().min(0).max(100).optional()
});

/**
 * Schema for feature priority distribution input
 */
export const FeaturePriorityDistributionSchema = z.object({
    category: z.string().optional(),
    includeUnavailable: z.boolean().default(false)
});

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Feature summary schema for quick display
 */
export const FeatureSummarySchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    isBuiltin: true,
    isFeatured: true
});

/**
 * Feature statistics schema
 */
export const FeatureStatsSchema = z.object({
    // Basic statistics
    totalFeatures: z.number().int().min(0).default(0),
    availableFeatures: z.number().int().min(0).default(0),
    unavailableFeatures: z.number().int().min(0).default(0),
    unusedFeatures: z.number().int().min(0).default(0),
    totalUsages: z.number().int().min(0).default(0),
    averageUsagePerFeature: z.number().min(0).default(0),

    // Priority statistics
    averagePriority: z.number().min(0).max(100).default(0),
    priorityDistribution: z
        .object({
            critical: z.number().int().min(0).default(0), // 90-100
            high: z.number().int().min(0).default(0), // 70-89
            medium: z.number().int().min(0).default(0), // 40-69
            low: z.number().int().min(0).default(0), // 10-39
            minimal: z.number().int().min(0).default(0) // 0-9
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

    totalCategories: z.number().int().min(0).default(0),

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
    featuresCreatedToday: z.number().int().min(0).default(0),
    featuresCreatedThisWeek: z.number().int().min(0).default(0),
    featuresCreatedThisMonth: z.number().int().min(0).default(0),

    // Content statistics
    featuresWithIcons: z.number().int().min(0).default(0),
    featuresWithoutIcons: z.number().int().min(0).default(0),
    featuresWithDescription: z.number().int().min(0).default(0),
    averageDescriptionLength: z.number().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FeatureFilters = z.infer<typeof FeatureFiltersSchema>;
export type FeatureSearchInput = z.infer<typeof FeatureSearchSchema>;
export type FeatureListItem = z.infer<typeof FeatureListItemSchema>;
export type FeatureSearchResultItem = z.infer<typeof FeatureSearchResultItemSchema>;
export type FeatureListResponse = z.infer<typeof FeatureListResponseSchema>;
export type FeatureSearchResponse = z.infer<typeof FeatureSearchResponseSchema>;
export type FeatureListWithGroupingResponse = z.infer<typeof FeatureListWithGroupingResponseSchema>;
export type FeatureCategoriesInput = z.infer<typeof FeatureCategoriesSchema>;
export type PopularFeaturesInput = z.infer<typeof PopularFeaturesSchema>;
export type FeaturePriorityDistributionInput = z.infer<typeof FeaturePriorityDistributionSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
export type FeatureStats = z.infer<typeof FeatureStatsSchema>;

// Compatibility aliases for existing code
export type FeatureListInput = FeatureSearchInput;
export type FeatureListOutput = FeatureListResponse;
export type FeatureSearchOutput = FeatureSearchResponse;
export type FeatureSearchResult = FeatureSearchResultItem;

// Legacy compatibility exports
export const FeatureListInputSchema = FeatureSearchSchema;
export const FeatureListOutputSchema = FeatureListResponseSchema;
export const FeatureSearchInputSchema = FeatureSearchSchema;
export const FeatureSearchOutputSchema = FeatureSearchResponseSchema;
export const FeatureCategoriesInputSchema = FeatureCategoriesSchema;
export const PopularFeaturesInputSchema = PopularFeaturesSchema;
export const FeaturePriorityDistributionInputSchema = FeaturePriorityDistributionSchema;

// Additional missing legacy exports
export const FeatureCategoriesOutputSchema = z.object({
    categories: z.array(
        z.object({
            category: z.string(),
            count: z.number().int().min(0),
            averagePriority: z.number().min(0).max(100),
            features: z.array(FeatureListItemSchema).optional()
        })
    )
});

export const FeatureSearchResultSchema = FeatureSearchResponseSchema;

export const FeaturePriorityDistributionOutputSchema = z.object({
    distribution: z.array(
        z.object({
            priority: z.number().int().min(0).max(100),
            count: z.number().int().min(0)
        })
    ),
    averagePriority: z.number().min(0).max(100),
    medianPriority: z.number().min(0).max(100)
});

export const PopularFeaturesOutputSchema = z.object({
    features: z.array(
        FeatureListItemSchema.extend({
            popularity: z.number().min(0).max(1),
            rank: z.number().int().min(1)
        })
    ),
    total: z.number().int().min(0),
    timeframe: z.string()
});

// Simple search schema for legacy compatibility
export const SimpleFeatureSearchSchema = z
    .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        isFeatured: z.boolean().optional(),
        isBuiltin: z.boolean().optional()
    })
    .strict();

export type SimpleFeatureSearch = z.infer<typeof SimpleFeatureSearchSchema>;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible feature search schema with query string coercion
 */
export const HttpFeatureSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Availability filters with coercion
    isAvailable: z.coerce.boolean().optional(),
    hasIcon: z.coerce.boolean().optional(),
    hasDescription: z.coerce.boolean().optional(),
    isFeatured: z.coerce.boolean().optional(),
    isBuiltin: z.coerce.boolean().optional(),

    // Date filters with coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Usage filters with coercion
    minUsageCount: z.coerce.number().int().min(0).optional(),
    maxUsageCount: z.coerce.number().int().min(0).optional(),
    isPopular: z.coerce.boolean().optional(),

    // Array filters (comma-separated)
    categories: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpFeatureSearch = z.infer<typeof HttpFeatureSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for feature search schema
 */
export const FEATURE_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'FeatureSearch',
    description:
        'Schema for searching and filtering accommodation features with availability and usage filters',
    title: 'Feature Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        q: 'pool',
        category: 'amenities',
        isAvailable: true,
        hasIcon: true,
        isFeatured: true,
        minUsageCount: 10
    },
    fields: {
        page: {
            description: 'Page number (1-based)',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        q: {
            description: 'Search query (searches name, description)',
            example: 'pool',
            maxLength: 100
        },
        category: {
            description: 'Filter by feature category',
            example: 'amenities'
        },
        isAvailable: {
            description: 'Filter available features',
            example: true
        },
        hasIcon: {
            description: 'Filter features with icons',
            example: true
        },
        isFeatured: {
            description: 'Filter featured features',
            example: true
        },
        minUsageCount: {
            description: 'Minimum usage count across accommodations',
            example: 10,
            minimum: 0
        }
    },
    tags: ['features', 'search']
};

/**
 * Feature search schema with OpenAPI metadata applied
 */
export const FeatureSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpFeatureSearchSchema,
    FEATURE_SEARCH_METADATA
);
