import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Amenity Query Schemas
 *
 * Standardized query schemas for amenity operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for amenities
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Amenity-specific filters that extend the base search functionality
 */
export const AmenityFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Content filters
    hasIcon: z.boolean().optional(),
    hasDescription: z.boolean().optional(),

    // Usage filters
    minUsageCount: z.number().int().min(0).optional(),
    maxUsageCount: z.number().int().min(0).optional(),
    isUnused: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),
    descriptionContains: z.string().min(1).max(100).optional(),

    // Popularity filters
    isPopular: z.boolean().optional(),
    popularityThreshold: z.number().int().min(1).optional(),

    // Category grouping
    categories: z.array(z.string()).optional()
});
export type AmenityFilters = z.infer<typeof AmenityFiltersSchema>;

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Standard amenity search schema with flat filter pattern
 * Migrated from nested filters to flat pattern for consistency
 */
export const AmenitySearchSchema = BaseSearchSchema.extend({
    // Basic filters (flattened from nested structure)
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Content filters
    hasIcon: z.boolean().optional(),
    hasDescription: z.boolean().optional(),

    // Usage filters
    minUsageCount: z.number().int().min(0).optional(),
    maxUsageCount: z.number().int().min(0).optional(),
    isUnused: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),
    descriptionContains: z.string().min(1).max(100).optional(),

    // Popularity filters
    isPopular: z.boolean().optional(),
    popularityThreshold: z.number().int().min(1).optional(),

    // Category grouping
    categories: z.array(z.string()).optional(),

    // Search options (preserved from original)
    searchInDescription: z.boolean().default(true).optional(),
    fuzzySearch: z.boolean().default(true).optional(),
    groupByCategory: z.boolean().default(false).optional()
});
export type AmenitySearchInput = z.infer<typeof AmenitySearchSchema>;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible amenity search schema with query string coercion
 */
export const HttpAmenitySearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Boolean filters with coercion
    hasIcon: z.coerce.boolean().optional(),
    hasDescription: z.coerce.boolean().optional(),
    isUnused: z.coerce.boolean().optional(),
    isPopular: z.coerce.boolean().optional(),
    searchInDescription: z.coerce.boolean().default(true).optional(),
    fuzzySearch: z.coerce.boolean().default(true).optional(),
    groupByCategory: z.coerce.boolean().default(false).optional(),

    // Numeric filters with coercion
    minUsageCount: z.coerce.number().int().min(0).optional(),
    maxUsageCount: z.coerce.number().int().min(0).optional(),
    popularityThreshold: z.coerce.number().int().min(1).optional(),

    // Date filters with coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // String pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),
    descriptionContains: z.string().min(1).max(100).optional(),

    // Array filters (comma-separated)
    categories: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpAmenitySearch = z.infer<typeof HttpAmenitySearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for amenity search schema
 */
export const AMENITY_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'AmenitySearch',
    description: 'Schema for searching and filtering amenities with comprehensive options',
    title: 'Amenity Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        q: 'wifi',
        category: 'connectivity',
        hasIcon: true,
        isPopular: true,
        minUsageCount: 10,
        nameContains: 'pool'
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
            example: 'wifi',
            maxLength: 100
        },
        category: {
            description: 'Filter by amenity category',
            example: 'connectivity'
        },
        hasIcon: {
            description: 'Filter amenities that have icons',
            example: true
        },
        isPopular: {
            description: 'Filter popular amenities',
            example: true
        },
        minUsageCount: {
            description: 'Minimum usage count across accommodations',
            example: 10,
            minimum: 0
        },
        nameContains: {
            description: 'Filter amenities whose names contain this text',
            example: 'pool',
            maxLength: 50
        }
    },
    tags: ['amenities', 'search']
};

/**
 * Amenity search schema with OpenAPI metadata applied
 */
export const AmenitySearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpAmenitySearchSchema,
    AMENITY_SEARCH_METADATA
);

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Amenity list item schema - contains essential fields for list display
 */
export const AmenityListItemSchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    type: true,
    icon: true,
    isBuiltin: true,
    isFeatured: true,
    createdAt: true,
    updatedAt: true
}).extend({
    // Add computed/additional fields that may be included in list responses
    usageCount: z.number().int().min(0).optional(),
    accommodationCount: z.number().int().min(0).optional()
});
export type AmenityListItem = z.infer<typeof AmenityListItemSchema>;

/**
 * Amenity search result item - extends list item with search relevance score
 */
export const AmenitySearchResultItemSchema = AmenityListItemSchema.extend({
    score: z.number().min(0).max(1).optional(),
    matchedFields: z.array(z.enum(['name', 'description', 'category'])).optional()
});
export type AmenitySearchResultItem = z.infer<typeof AmenitySearchResultItemSchema>;

/**
 * Amenity with accommodation count - used in special listing views
 */
export const AmenityWithAccommodationCountSchema = AmenityListItemSchema.extend({
    accommodationCount: z.number().int().min(0).optional()
});
export type AmenityWithAccommodationCount = z.infer<typeof AmenityWithAccommodationCountSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Amenity list response using standardized pagination format
 */
export const AmenityListResponseSchema = PaginationResultSchema(AmenityListItemSchema);
export type AmenityListResponse = z.infer<typeof AmenityListResponseSchema>;

/**
 * Amenity search response using standardized pagination format with search results
 */
export const AmenitySearchResponseSchema = PaginationResultSchema(AmenitySearchResultItemSchema);
export type AmenitySearchResponse = z.infer<typeof AmenitySearchResponseSchema>;

/**
 * Extended amenity list response with grouping options
 */
export const AmenityListWithGroupingResponseSchema = AmenityListResponseSchema.extend({
    groupedByCategory: z.record(z.string(), z.array(AmenityListItemSchema)).optional()
});
export type AmenityListWithGroupingResponse = z.infer<typeof AmenityListWithGroupingResponseSchema>;

/**
 * Amenity list with accommodation counts response
 */
export const AmenityListWithCountsResponseSchema = PaginationResultSchema(
    AmenityWithAccommodationCountSchema
);
export type AmenityListWithCountsResponse = z.infer<typeof AmenityListWithCountsResponseSchema>;

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for amenity categories input
 */
export const AmenityCategoriesSchema = z.object({
    includeUsageCount: z.boolean().default(true),
    minUsageCount: z.number().int().min(0).default(0),
    sortBy: z.enum(['name', 'usageCount', 'amenityCount']).default('name')
});
export type AmenityCategoriesInput = z.infer<typeof AmenityCategoriesSchema>;

/**
 * Schema for popular amenities input
 */
export const PopularAmenitiesSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
    category: z.string().optional(),
    timeframe: z.enum(['all', 'year', 'month', 'week']).default('all')
});
export type PopularAmenitiesInput = z.infer<typeof PopularAmenitiesSchema>;

/**
 * Schema for getting accommodations by amenity
 */
export const AmenityGetAccommodationsSchema = z.object({
    amenityId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});
export type AmenityGetAccommodationsInput = z.infer<typeof AmenityGetAccommodationsSchema>;

/**
 * Schema for getting amenities for accommodation
 */
export const AmenityGetForAccommodationSchema = z.object({
    accommodationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});
export type AmenityGetForAccommodationInput = z.infer<typeof AmenityGetForAccommodationSchema>;

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Amenity summary schema for quick display
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
export type AmenitySummary = z.infer<typeof AmenitySummarySchema>;

// Removed duplicate AmenityStatsSchema - now defined in wrapper section below

// Compatibility aliases for existing code
export type AmenityListInput = AmenitySearchInput;
export type AmenityListOutput = AmenityListResponse;
export type AmenitySearchOutput = AmenitySearchResponse;
export type AmenitySearchResult = AmenitySearchResultItem;
export type AmenityListWithUsageCount = AmenityWithAccommodationCount;
export type AmenitySearchForListOutput = AmenityListWithCountsResponse;
export type AmenityAccommodationsOutput = AmenityListResponse;

// Additional compatibility schema
const AmenityListWrapperSchemaCompat = z.object({ amenities: z.array(AmenitySchema) });
export type AmenityListWrapperCompat = z.infer<typeof AmenityListWrapperSchemaCompat>;

// Legacy compatibility exports
export const AmenityListInputSchema = AmenitySearchSchema;
export const AmenityListOutputSchema = AmenityListResponseSchema;
export const AmenitySearchInputSchema = AmenitySearchSchema;
export const AmenitySearchOutputSchema = AmenitySearchResponseSchema;
export const AmenityCategoriesInputSchema = AmenityCategoriesSchema;
export const PopularAmenitiesInputSchema = PopularAmenitiesSchema;
export const AmenityGetAccommodationsInputSchema = AmenityGetAccommodationsSchema;
export const AmenityGetForAccommodationInputSchema = AmenityGetForAccommodationSchema;
export const AmenityListWithUsageCountSchema = AmenityWithAccommodationCountSchema;
export const AmenitySearchForListOutputSchema = AmenityListWithCountsResponseSchema;
export const AmenityAccommodationsOutputSchema = AmenityListResponseSchema;

// Legacy compatibility - deprecated, use AmenityListWrapper instead
const AmenityArraySchema = z.object({ amenities: z.array(AmenitySchema) });
export type AmenityArrayOutput = z.infer<typeof AmenityArraySchema>;
export const AmenityArrayOutputSchema = z.object({ amenities: z.array(AmenitySchema) });

// Additional missing legacy exports
export const AmenityCategoriesOutputSchema = z.object({
    categories: z.array(
        z.object({
            category: z.string(),
            count: z.number().int().min(0),
            amenities: z.array(AmenityListItemSchema).optional()
        })
    )
});

export const AmenitySearchResultSchema = AmenitySearchResponseSchema;

export const PopularAmenitiesOutputSchema = z.object({
    amenities: z.array(
        AmenityWithAccommodationCountSchema.extend({
            popularity: z.number().min(0).max(1)
        })
    ),
    total: z.number().int().min(0),
    threshold: z.number().int().min(0)
});

// ============================================================================
// WRAPPER SCHEMAS (for service consistency)
// ============================================================================

/**
 * Wrapper schema for amenity list responses
 * Follows the established pattern: { amenities: Amenity[] }
 */
export const AmenityListWrapperSchema = z.object({
    amenities: z.array(AmenityListItemSchema)
});
export type AmenityListWrapper = z.infer<typeof AmenityListWrapperSchema>;

/**
 * Wrapper schema for amenity statistics responses
 * Follows the established pattern: { stats: AmenityStats }
 */
export const AmenityStatsSchema = z.object({
    total: z.number().int().min(0).default(0),
    totalBuiltin: z.number().int().min(0).default(0),
    totalCustom: z.number().int().min(0).default(0),
    totalFeatured: z.number().int().min(0).default(0),
    averageUsageCount: z.number().min(0).default(0),

    // Usage distribution
    usageDistribution: z.object({
        unused: z.number().int().min(0).default(0),
        lowUsage: z.number().int().min(0).default(0), // 1-5 uses
        mediumUsage: z.number().int().min(0).default(0), // 6-20 uses
        highUsage: z.number().int().min(0).default(0) // 21+ uses
    }),

    // Type distribution
    totalByType: z.record(z.string(), z.number().int().min(0)).optional(),

    // Popular amenities
    mostPopular: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                usageCount: z.number().int().min(0)
            })
        )
        .max(10)
        .optional()
});

export const AmenityStatsWrapperSchema = z.object({
    stats: AmenityStatsSchema
});

/**
 * Wrapper schema for accommodation list responses (for amenity relations)
 */
export const AmenityAccommodationListWrapperSchema = z.object({
    accommodations: z.array(
        z.object({
            id: z.string().uuid(),
            name: z.string(),
            slug: z.string().optional(),
            summary: z.string().optional(),
            // Basic accommodation info for amenity context
            isFeatured: z.boolean().optional(),
            averageRating: z.number().min(0).max(5).optional()
        })
    )
});

// Type exports for wrapper schemas
export type AmenityStats = z.infer<typeof AmenityStatsSchema>;
export type AmenityStatsWrapper = z.infer<typeof AmenityStatsWrapperSchema>;
export type AmenityAccommodationListWrapper = z.infer<typeof AmenityAccommodationListWrapperSchema>;
