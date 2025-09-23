import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
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
