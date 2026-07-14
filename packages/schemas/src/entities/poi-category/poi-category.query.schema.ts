import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';
import { applyOpenApiMetadata, type OpenApiSchemaMetadata } from '../../utils/openapi.utils.js';
import { PoiCategorySchema } from './poi-category.schema.js';

/**
 * POI Category Query Schemas
 *
 * Standardized query schemas for POI category operations following the
 * unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for POI categories
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * POI-category-specific filters that extend the base search functionality
 */
export const PoiCategoryFiltersSchema = z.object({
    // Basic filters
    slug: z.string().optional(),

    // Lifecycle state
    lifecycleState: LifecycleStatusEnumSchema.optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete POI category search schema combining base search with
 * POI-category-specific filters. Flat pattern for HTTP compatibility.
 */
export const PoiCategorySearchSchema = BaseSearchSchema.extend({
    slug: z.string().optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * POI category list item schema - contains essential fields for list display
 */
export const PoiCategoryListItemSchema = PoiCategorySchema.pick({
    id: true,
    slug: true,
    nameI18n: true,
    icon: true,
    displayWeight: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * POI category search result item - extends list item with search relevance score
 */
export const PoiCategorySearchResultItemSchema = PoiCategoryListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * POI category with point-of-interest count - used in special listing views
 */
export const PoiCategoryWithPointOfInterestCountSchema = PoiCategoryListItemSchema.extend({
    pointOfInterestCount: z.number().int().min(0).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const PoiCategoryListResponseSchema = PaginationResultSchema(PoiCategoryListItemSchema);

export const PoiCategorySearchResponseSchema = PaginationResultSchema(
    PoiCategorySearchResultItemSchema
);

export const PoiCategoryListWithCountsResponseSchema = PaginationResultSchema(
    PoiCategoryWithPointOfInterestCountSchema
);

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting POI categories assigned to a point of interest
 */
export const PoiCategoriesByPointOfInterestSchema = z.object({
    pointOfInterestId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

/**
 * Schema for getting points of interest tagged with a category
 */
export const PointsOfInterestByPoiCategorySchema = z.object({
    categoryId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * POI category statistics schema
 */
export const PoiCategoryStatsSchema = z.object({
    total: z.number().int().min(0).default(0),

    // Point-of-interest distribution
    byPointOfInterestCount: z.record(z.string(), z.number().int().min(0)).optional(),

    // Lifecycle state distribution
    byLifecycleState: z.record(z.string(), z.number().int().min(0)).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PoiCategoryFilters = z.infer<typeof PoiCategoryFiltersSchema>;
export type PoiCategorySearchInput = z.infer<typeof PoiCategorySearchSchema>;
export type PoiCategoryListItem = z.infer<typeof PoiCategoryListItemSchema>;
export type PoiCategorySearchResultItem = z.infer<typeof PoiCategorySearchResultItemSchema>;
export type PoiCategoryWithPointOfInterestCount = z.infer<
    typeof PoiCategoryWithPointOfInterestCountSchema
>;
export type PoiCategoryListResponse = z.infer<typeof PoiCategoryListResponseSchema>;
export type PoiCategorySearchResponse = z.infer<typeof PoiCategorySearchResponseSchema>;
export type PoiCategoryListWithCountsResponse = z.infer<
    typeof PoiCategoryListWithCountsResponseSchema
>;
export type PoiCategoriesByPointOfInterestInput = z.infer<
    typeof PoiCategoriesByPointOfInterestSchema
>;
export type PointsOfInterestByPoiCategoryInput = z.infer<
    typeof PointsOfInterestByPoiCategorySchema
>;
export type PoiCategoryStats = z.infer<typeof PoiCategoryStatsSchema>;

// Compatibility aliases for existing code (mirrors attraction.query.schema.ts)
export type PoiCategoryListInput = PoiCategorySearchInput;
export type PoiCategoryListOutput = PoiCategoryListResponse;
export type PoiCategorySearchOutput = PoiCategorySearchResponse;
export type PoiCategoryListWithCountsOutput = PoiCategoryListWithCountsResponse;

// Additional compatibility schemas
const PoiCategoryCountSchema = z.object({ count: z.number().int().min(0) });
const PoiCategoryStatsWrapperSchema = z.object({ stats: PoiCategoryStatsSchema.nullable() });
export type PoiCategoryCountOutput = z.infer<typeof PoiCategoryCountSchema>;
export type PoiCategoryStatsOutput = z.infer<typeof PoiCategoryStatsWrapperSchema>;

// Legacy compatibility exports
export const PoiCategoryListInputSchema = PoiCategorySearchSchema;
export const PoiCategoryListOutputSchema = PoiCategoryListResponseSchema;
export const PoiCategorySearchInputSchema = PoiCategorySearchSchema;
export const PoiCategorySearchOutputSchema = PoiCategorySearchResponseSchema;
export const PoiCategoryListWithCountsOutputSchema = PoiCategoryListWithCountsResponseSchema;
export const PoiCategoriesByPointOfInterestInputSchema = PoiCategoriesByPointOfInterestSchema;
export const PoiCategoriesByPointOfInterestOutputSchema = PoiCategoryListResponseSchema;
export const PointsOfInterestByPoiCategoryInputSchema = PointsOfInterestByPoiCategorySchema;
export const PoiCategoryCountOutputSchema = z.object({ count: z.number().int().min(0) });

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible POI category search schema with query string coercion
 */
export const HttpPoiCategorySearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    slug: z.string().optional(),

    // Lifecycle state
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Date filters with coercion
    createdAfter: HttpQueryFields.createdAfter(),
    createdBefore: HttpQueryFields.createdBefore()
});

export type HttpPoiCategorySearch = z.infer<typeof HttpPoiCategorySearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for POI category search schema
 */
export const POI_CATEGORY_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'PoiCategorySearch',
    description: 'Schema for searching and filtering POI categories with comprehensive options',
    title: 'POI Category Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'displayWeight',
        sortOrder: 'asc',
        q: 'museo',
        slug: 'museum'
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
            description: 'Search query (searches slug, nameI18n)',
            example: 'museo',
            maxLength: 100
        },
        slug: {
            description: 'Filter by exact category slug',
            example: 'museum'
        }
    },
    tags: ['poi-categories', 'search']
};

/**
 * POI category search schema with OpenAPI metadata applied
 */
export const PoiCategorySearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpPoiCategorySearchSchema,
    POI_CATEGORY_SEARCH_METADATA
);
export const PoiCategoryStatsOutputSchema = z.object({ stats: PoiCategoryStatsSchema.nullable() });
