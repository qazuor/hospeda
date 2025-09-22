import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * Destination Query Schemas
 *
 * Standardized query schemas for destination operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for destinations
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Destination-specific filters that extend the base search functionality
 */
export const DestinationFiltersSchema = z.object({
    // Basic filters
    isFeatured: z.boolean().optional(),

    // Location filters
    country: z.string().length(2).optional(), // ISO country code
    state: z.string().min(1).max(100).optional(),
    city: z.string().min(1).max(100).optional(),

    // Geographic radius search
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius: z.number().min(0).max(1000).optional(), // kilometers

    // Accommodation metrics
    minAccommodations: z.number().int().min(0).optional(),
    maxAccommodations: z.number().int().min(0).optional(),

    // Rating filter
    minRating: z.number().min(0).max(5).optional(),

    // Tags filter
    tags: z.array(z.string().uuid()).optional(),

    // Features
    hasAttractions: z.boolean().optional(),
    climate: z.string().min(1).max(50).optional(),
    bestSeason: z.string().min(1).max(50).optional()
});
export type DestinationFilters = z.infer<typeof DestinationFiltersSchema>;

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete destination search schema combining base search with destination-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: Destination-specific filtering options
 */
export const DestinationSearchSchema = BaseSearchSchema.extend({
    filters: DestinationFiltersSchema.optional()
});
export type DestinationSearchInput = z.infer<typeof DestinationSearchSchema>;

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Destination list item schema - contains essential fields for list display
 */
export const DestinationListItemSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    location: true,
    media: true,
    accommodationsCount: true,
    averageRating: true,
    reviewsCount: true,
    createdAt: true,
    updatedAt: true
});
export type DestinationListItem = z.infer<typeof DestinationListItemSchema>;

/**
 * Destination search result item - extends list item with search relevance score
 */
export const DestinationSearchResultItemSchema = DestinationListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});
export type DestinationSearchResultItem = z.infer<typeof DestinationSearchResultItemSchema>;

/**
 * Destination with attraction names - for list display with attraction names included
 */
export const DestinationWithAttractionNamesSchema = DestinationSchema.extend({
    attractionNames: z.array(z.string())
});
export type DestinationWithAttractionNames = z.infer<typeof DestinationWithAttractionNamesSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Destination list response using standardized pagination format
 */
export const DestinationListResponseSchema = PaginationResultSchema(DestinationListItemSchema);
export type DestinationListResponse = z.infer<typeof DestinationListResponseSchema>;

/**
 * Destination search response using standardized pagination format with search results
 */
export const DestinationSearchResponseSchema = PaginationResultSchema(
    DestinationSearchResultItemSchema
);
export type DestinationSearchResponse = z.infer<typeof DestinationSearchResponseSchema>;

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Destination summary schema for quick display
 */
export const DestinationSummarySchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    media: true,
    location: true,
    isFeatured: true,
    averageRating: true,
    reviewsCount: true,
    accommodationsCount: true
});
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;

/**
 * Destination statistics schema
 */
export const DestinationStatsSchema = z.object({
    accommodationsCount: z.number().int().min(0).default(0),
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0),
    attractionsCount: z.number().int().min(0).default(0),
    eventsCount: z.number().int().min(0).default(0)
});
export type DestinationStats = z.infer<typeof DestinationStatsSchema>;

// Compatibility aliases for existing code
export type DestinationSummaryType = DestinationSummary;
export type DestinationSearchForListOutput = DestinationListResponse;
export type DestinationListInput = DestinationSearchInput;
export type DestinationListOutput = DestinationListResponse;
export type DestinationSearchOutput = DestinationSearchResponse;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Legacy schema aliases for backward compatibility with .type.ts files
export const DestinationListInputSchema = DestinationSearchSchema;
export const DestinationListOutputSchema = DestinationListResponseSchema;
export const DestinationSearchInputSchema = DestinationSearchSchema;
export const DestinationSearchOutputSchema = DestinationSearchResponseSchema;
export const DestinationSearchResultSchema = DestinationSearchResponseSchema;
export const DestinationSearchForListOutputSchema = DestinationListResponseSchema;

// Additional missing legacy exports
export const DestinationListItemWithStringAttractionsSchema = DestinationListItemSchema.extend({
    attractions: z.array(z.string()).optional()
});
export const GetDestinationAccommodationsInputSchema = z.object({
    destinationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    filters: z
        .object({
            type: z.string().optional(),
            minPrice: z.number().min(0).optional(),
            maxPrice: z.number().min(0).optional(),
            minRating: z.number().min(0).max(5).optional()
        })
        .optional()
});
export type GetDestinationAccommodationsInput = z.infer<
    typeof GetDestinationAccommodationsInputSchema
>;

export const GetDestinationStatsInputSchema = z.object({
    destinationId: z.string().uuid()
});
export type GetDestinationStatsInput = z.infer<typeof GetDestinationStatsInputSchema>;

export const GetDestinationSummaryInputSchema = z.object({
    destinationId: z.string().uuid()
});
export type GetDestinationSummaryInput = z.infer<typeof GetDestinationSummaryInputSchema>;
export const DestinationFilterInputSchema = DestinationFiltersSchema;
export type DestinationFilterInput = z.infer<typeof DestinationFilterInputSchema>;
export const DestinationSummaryExtendedSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    description: true,
    media: true,
    location: true,
    isFeatured: true,
    averageRating: true,
    reviewsCount: true,
    accommodationsCount: true,
    attractions: true,
    tags: true,
    climate: true
});
