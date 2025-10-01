import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation Query Schemas - Standardized Implementation
 *
 * This file contains all schemas related to querying accommodations following the unified standard:
 * - Pagination: page/pageSize pattern
 * - Sorting: sortBy/sortOrder with 'asc'/'desc' values
 * - Search: 'q' field for text search
 * - Filters: entity-specific filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for accommodation-specific filters
 */
export const AccommodationFiltersSchema = z.object({
    // Basic filters
    type: AccommodationTypeEnumSchema.optional(),
    isFeatured: z.boolean().optional(),

    // Price range filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Location filters
    destinationId: z.string().uuid().optional(),
    country: z.string().length(2).optional(),
    city: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius: z.number().positive().optional(), // in kilometers

    // Capacity filters
    minGuests: z.number().int().min(1).optional(),
    maxGuests: z.number().int().min(1).optional(),
    minBedrooms: z.number().int().min(0).optional(),
    maxBedrooms: z.number().int().min(0).optional(),
    minBathrooms: z.number().int().min(0).optional(),
    maxBathrooms: z.number().int().min(0).optional(),

    // Rating filters
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),

    // Amenities filter
    amenities: z.array(z.string().uuid()).optional(),

    // Host filter
    hostId: z.string().uuid().optional(),

    // Availability filters
    checkIn: z.date().optional(),
    checkOut: z.date().optional(),
    isAvailable: z.boolean().optional()
});

// Type: Filters
export type AccommodationFilters = z.infer<typeof AccommodationFiltersSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard accommodation search schema
 */
export const AccommodationSearchSchema = BaseSearchSchema.extend({
    // Entity-specific filters
    type: AccommodationTypeEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    destinationId: z.string().uuid().optional(),
    country: z.string().length(2).optional(),
    city: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius: z.number().positive().optional(),
    minGuests: z.number().int().min(1).optional(),
    maxGuests: z.number().int().min(1).optional(),
    minBedrooms: z.number().int().min(0).optional(),
    maxBedrooms: z.number().int().min(0).optional(),
    minBathrooms: z.number().int().min(0).optional(),
    maxBathrooms: z.number().int().min(0).optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    amenities: z.array(z.string().uuid()).optional(),
    hostId: z.string().uuid().optional(),
    checkIn: z.date().optional(),
    checkOut: z.date().optional(),
    isAvailable: z.boolean().optional()
});

// Type: Search Input
export type AccommodationSearch = z.infer<typeof AccommodationSearchSchema>;
export type AccommodationSearchInput = z.infer<typeof AccommodationSearchSchema>;

/**
 * Standard accommodation search result schema
 */
export const AccommodationSearchResultSchema = PaginationResultSchema(AccommodationSchema);

// Type: Search Result
export type AccommodationSearchResult = z.infer<typeof AccommodationSearchResultSchema>;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible accommodation search schema with query string coercion
 * Converts string query parameters to appropriate types for web requests
 */
export const HttpAccommodationSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    type: AccommodationTypeEnumSchema.optional(),
    isFeatured: z.coerce.boolean().optional(),

    // Price filters with coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Date filters with coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    checkIn: z.coerce.date().optional(),
    checkOut: z.coerce.date().optional(),

    // Location filters
    destinationId: z.string().uuid().optional(),
    country: z.string().length(2).optional(),
    city: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),

    // Capacity filters with coercion
    minGuests: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).optional(),
    minBedrooms: z.coerce.number().int().min(0).optional(),
    maxBedrooms: z.coerce.number().int().min(0).optional(),
    minBathrooms: z.coerce.number().int().min(0).optional(),
    maxBathrooms: z.coerce.number().int().min(0).optional(),

    // Rating filters with coercion
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),

    // Array filters (comma-separated)
    amenities: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),

    // UUID filters
    hostId: z.string().uuid().optional(),

    // Boolean filters with coercion
    isAvailable: z.coerce.boolean().optional()
});

export type HttpAccommodationSearch = z.infer<typeof HttpAccommodationSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for accommodation search schema
 */
export const ACCOMMODATION_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'AccommodationSearch',
    description: 'Schema for searching and filtering accommodations with comprehensive filters',
    title: 'Accommodation Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        q: 'beachfront villa',
        type: 'villa',
        isFeatured: true,
        minPrice: 100,
        maxPrice: 500,
        currency: 'USD',
        destinationId: '123e4567-e89b-12d3-a456-426614174000',
        minGuests: 2,
        maxGuests: 8,
        minRating: 4.0,
        amenities: 'pool,wifi,parking'
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
            example: 'beachfront villa',
            maxLength: 100
        },
        type: {
            description: 'Filter by accommodation type',
            example: 'villa',
            enum: ['apartment', 'house', 'villa', 'hotel', 'hostel', 'other']
        },
        minPrice: {
            description: 'Minimum price per night',
            example: 100,
            minimum: 0
        },
        maxPrice: {
            description: 'Maximum price per night',
            example: 500,
            minimum: 0
        },
        destinationId: {
            description: 'Filter by destination UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        minGuests: {
            description: 'Minimum guest capacity',
            example: 2,
            minimum: 1
        },
        maxGuests: {
            description: 'Maximum guest capacity',
            example: 8,
            minimum: 1
        },
        minRating: {
            description: 'Minimum average rating',
            example: 4.0,
            minimum: 0,
            maximum: 5
        },
        amenities: {
            description: 'Comma-separated list of required amenity IDs',
            example: 'pool,wifi,parking'
        }
    },
    tags: ['accommodations', 'search']
};

/**
 * Accommodation search schema with OpenAPI metadata applied
 */
export const AccommodationSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpAccommodationSearchSchema,
    ACCOMMODATION_SEARCH_METADATA
);

// ============================================================================
// LIST ITEM SCHEMA
// ============================================================================

/**
 * Schema for accommodation list items (public-safe fields)
 */
export const AccommodationListItemSchema = AccommodationSchema.pick({
    id: true,
    name: true,
    slug: true,
    type: true,
    description: true,
    price: true,
    location: true,
    media: true,
    reviewsCount: true,
    averageRating: true,
    isFeatured: true,
    ownerId: true,
    createdAt: true,
    updatedAt: true
});

// Type: List Item
export type AccommodationListItem = z.infer<typeof AccommodationListItemSchema>;

/**
 * Schema for accommodation summary (essential fields only)
 */
export const AccommodationSummarySchema = AccommodationSchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true, // Add summary field since it's needed for accommodation summary
    type: true,
    price: true,
    location: true,
    media: true,
    reviewsCount: true,
    averageRating: true,
    isFeatured: true,
    ownerId: true
});
// Type: Summary
export type AccommodationSummary = z.infer<typeof AccommodationSummarySchema>;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Legacy schema aliases for backward compatibility with .type.ts files
export const AccommodationListInputSchema = AccommodationSearchSchema;
export const AccommodationListOutputSchema = AccommodationSearchResultSchema;
export const AccommodationSearchInputSchema = AccommodationSearchSchema;
export const AccommodationSearchOutputSchema = AccommodationSearchResultSchema;
export const AccommodationListWithTotalOutputSchema = AccommodationSearchResultSchema;

// Additional legacy schemas that may be referenced
export const AccommodationByDestinationOutputSchema = AccommodationSearchResultSchema;
export const AccommodationByDestinationParamsSchema = AccommodationSearchSchema;
export type AccommodationByDestinationParams = z.infer<
    typeof AccommodationByDestinationParamsSchema
>;
export const AccommodationListItemWithMiniRelationsSchema = AccommodationListItemSchema;
export const AccommodationNormalizedSchema = AccommodationSchema;
export const AccommodationStatsOutputSchema = z.object({
    total: z.number(),
    totalFeatured: z.number(),
    averagePrice: z.number().optional(),
    averageRating: z.number().optional(),
    totalByType: z.record(z.string(), z.number())
});
export type AccommodationStatsOutput = z.infer<typeof AccommodationStatsOutputSchema>;
export const AccommodationStatsResponseSchema = AccommodationStatsOutputSchema;
export const AccommodationStatsSchema = AccommodationStatsOutputSchema;
export const AccommodationStatsParamsSchema = z.object({
    destinationId: z.string().uuid().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional()
});
export type AccommodationStatsParams = z.infer<typeof AccommodationStatsParamsSchema>;
export const AccommodationSummaryParamsSchema = z.object({
    id: z.string().uuid()
});
export type AccommodationSummaryParams = z.infer<typeof AccommodationSummaryParamsSchema>;

// Wrapper schema for getSummary method
export const AccommodationSummaryWrapperSchema = z.object({
    accommodation: AccommodationSummarySchema.nullable()
});
export type AccommodationSummaryWrapper = z.infer<typeof AccommodationSummaryWrapperSchema>;

export const AccommodationTopRatedOutputSchema = AccommodationSearchResultSchema;
export const AccommodationTopRatedParamsSchema = z.object({
    limit: z.number().int().min(1).max(100).default(10),
    destinationId: z.string().uuid().optional()
});
export type AccommodationTopRatedParams = z.infer<typeof AccommodationTopRatedParamsSchema>;

// Mini schemas for related entities (these should ideally be imported from their respective files)
export const DestinationMiniSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    country: z.string().length(2),
    city: z.string().optional()
});

export const UserMiniSchema = z.object({
    id: z.string().uuid(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email(),
    avatar: z.string().url().optional()
});

// ============================================================================
// WRAPPER SCHEMAS FOR CONSISTENCY
// ============================================================================

/**
 * Wrapper schema for accommodation lists (non-paginated)
 * Provides consistent format for array responses
 */
export const AccommodationListWrapperSchema = z.object({
    accommodations: z.array(AccommodationSchema)
});
export type AccommodationListWrapper = z.infer<typeof AccommodationListWrapperSchema>;

/**
 * Wrapper schema for accommodation stats
 * Provides consistent format for stats responses
 */
export const AccommodationStatsWrapperSchema = z.object({
    stats: AccommodationStatsSchema
});
export type AccommodationStatsWrapper = z.infer<typeof AccommodationStatsWrapperSchema>;
