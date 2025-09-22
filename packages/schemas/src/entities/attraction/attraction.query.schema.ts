import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';
import { AttractionSchema } from './attraction.schema.js';

/**
 * Attraction Query Schemas
 *
 * Standardized query schemas for attraction operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for attractions
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Attraction-specific filters that extend the base search functionality
 */
export const AttractionFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isBuiltin: z.boolean().optional(),

    // Lifecycle state
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Location filters
    destinationId: z.string().uuid().optional(),

    // Type/category filters
    category: z.string().optional(),
    subcategory: z.string().optional(),

    // Accessibility filters
    isAccessible: z.boolean().optional(),
    isIndoor: z.boolean().optional(),
    isOutdoor: z.boolean().optional(),

    // Pricing filters
    isFree: z.boolean().optional(),
    hasEntryFee: z.boolean().optional(),

    // Tags filter
    tags: z.array(z.string().uuid()).optional(),

    // Operating status
    isOperational: z.boolean().optional(),
    isTemporarilyClosed: z.boolean().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete attraction search schema combining base search with attraction-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: Attraction-specific filtering options
 */
export const AttractionSearchSchema = BaseSearchSchema.extend({
    filters: AttractionFiltersSchema.optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Attraction list item schema - contains essential fields for list display
 */
export const AttractionListItemSchema = AttractionSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    isBuiltin: true,
    lifecycleState: true,
    location: true,
    media: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Attraction search result item - extends list item with search relevance score
 */
export const AttractionSearchResultItemSchema = AttractionListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * Attraction with destination count - used in special listing views
 */
export const AttractionWithDestinationCountSchema = AttractionListItemSchema.extend({
    destinationCount: z.number().int().min(0).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Attraction list response using standardized pagination format
 */
export const AttractionListResponseSchema = PaginationResultSchema(AttractionListItemSchema);

/**
 * Attraction search response using standardized pagination format with search results
 */
export const AttractionSearchResponseSchema = PaginationResultSchema(
    AttractionSearchResultItemSchema
);

/**
 * Attraction list with counts response
 */
export const AttractionListWithCountsResponseSchema = PaginationResultSchema(
    AttractionWithDestinationCountSchema
);

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting attractions by destination
 */
export const AttractionsByDestinationSchema = z.object({
    destinationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

/**
 * Schema for getting destinations by attraction
 */
export const DestinationsByAttractionSchema = z.object({
    attractionId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Attraction statistics schema
 */
export const AttractionStatsSchema = z.object({
    total: z.number().int().min(0).default(0),
    featured: z.number().int().min(0).default(0),
    builtin: z.number().int().min(0).default(0),
    operational: z.number().int().min(0).default(0),
    temporarilyClosed: z.number().int().min(0).default(0),

    // Category distribution
    byCategory: z.record(z.string(), z.number().int().min(0)).optional(),

    // Destination distribution
    byDestination: z.record(z.string(), z.number().int().min(0)).optional(),

    // Lifecycle state distribution
    byLifecycleState: z.record(z.string(), z.number().int().min(0)).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AttractionFilters = z.infer<typeof AttractionFiltersSchema>;
export type AttractionSearchInput = z.infer<typeof AttractionSearchSchema>;
export type AttractionListItem = z.infer<typeof AttractionListItemSchema>;
export type AttractionSearchResultItem = z.infer<typeof AttractionSearchResultItemSchema>;
export type AttractionWithDestinationCount = z.infer<typeof AttractionWithDestinationCountSchema>;
export type AttractionListResponse = z.infer<typeof AttractionListResponseSchema>;
export type AttractionSearchResponse = z.infer<typeof AttractionSearchResponseSchema>;
export type AttractionListWithCountsResponse = z.infer<
    typeof AttractionListWithCountsResponseSchema
>;
export type AttractionsByDestinationInput = z.infer<typeof AttractionsByDestinationSchema>;
export type DestinationsByAttractionInput = z.infer<typeof DestinationsByAttractionSchema>;
export type AttractionStats = z.infer<typeof AttractionStatsSchema>;

// Compatibility aliases for existing code
export type AttractionListInput = AttractionSearchInput;
export type AttractionListOutput = AttractionListResponse;
export type AttractionSearchOutput = AttractionSearchResponse;
export type AttractionListWithCountsOutput = AttractionListWithCountsResponse;
export type AttractionsByDestinationOutput = AttractionListResponse;
export type DestinationsByAttractionOutput = AttractionListResponse;

// Additional compatibility schemas
const AttractionCountSchema = z.object({ count: z.number().int().min(0) });
const AttractionStatsWrapperSchema = z.object({ stats: AttractionStatsSchema.nullable() });
export type AttractionCountOutput = z.infer<typeof AttractionCountSchema>;
export type AttractionStatsOutput = z.infer<typeof AttractionStatsWrapperSchema>;

// Legacy compatibility exports
export const AttractionListInputSchema = AttractionSearchSchema;
export const AttractionListOutputSchema = AttractionListResponseSchema;
export const AttractionSearchInputSchema = AttractionSearchSchema;
export const AttractionSearchOutputSchema = AttractionSearchResponseSchema;
export const AttractionListWithCountsOutputSchema = AttractionListWithCountsResponseSchema;
export const AttractionsByDestinationInputSchema = AttractionsByDestinationSchema;
export const AttractionsByDestinationOutputSchema = AttractionListResponseSchema;
export const DestinationsByAttractionInputSchema = DestinationsByAttractionSchema;
export const DestinationsByAttractionOutputSchema = AttractionListResponseSchema;
export const AttractionCountOutputSchema = z.object({ count: z.number().int().min(0) });
export const AttractionStatsOutputSchema = z.object({ stats: AttractionStatsSchema.nullable() });
