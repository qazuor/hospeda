import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
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

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible destination search schema with query string coercion
 */
export const HttpDestinationSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    isFeatured: z.coerce.boolean().optional(),

    // Location filters
    country: z.string().length(2).optional(),
    state: z.string().min(1).max(100).optional(),
    city: z.string().min(1).max(100).optional(),

    // Geographic radius search with coercion
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),

    // Date filters with coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Statistical filters with coercion
    minAccommodations: z.coerce.number().int().min(0).optional(),
    maxAccommodations: z.coerce.number().int().min(0).optional(),
    minAttractions: z.coerce.number().int().min(0).optional(),
    maxAttractions: z.coerce.number().int().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),

    // Content filters with coercion
    hasDescription: z.coerce.boolean().optional(),
    hasMedia: z.coerce.boolean().optional(),
    hasClimateInfo: z.coerce.boolean().optional(),

    // Array filters (comma-separated)
    tags: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpDestinationSearch = z.infer<typeof HttpDestinationSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for destination search schema
 */
export const DESTINATION_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'DestinationSearch',
    description:
        'Schema for searching and filtering destinations with location and statistics filters',
    title: 'Destination Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        q: 'beach paradise',
        isFeatured: true,
        country: 'ES',
        minAccommodations: 5,
        minRating: 4.0,
        hasMedia: true,
        tags: 'beach,tropical,family-friendly'
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
            description: 'Search query (searches name, description, location)',
            example: 'beach paradise',
            maxLength: 100
        },
        isFeatured: {
            description: 'Filter featured destinations',
            example: true
        },
        country: {
            description: 'Filter by country code (ISO 3166-1 alpha-2)',
            example: 'ES',
            minLength: 2,
            maxLength: 2
        },
        minAccommodations: {
            description: 'Minimum number of accommodations',
            example: 5,
            minimum: 0
        },
        minRating: {
            description: 'Minimum average rating',
            example: 4.0,
            minimum: 0,
            maximum: 5
        },
        hasMedia: {
            description: 'Filter destinations with media content',
            example: true
        },
        tags: {
            description: 'Comma-separated list of tags',
            example: 'beach,tropical,family-friendly'
        }
    },
    tags: ['destinations', 'search']
};

/**
 * Destination search schema with OpenAPI metadata applied
 */
export const DestinationSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpDestinationSearchSchema,
    DESTINATION_SEARCH_METADATA
);
