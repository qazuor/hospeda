import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * EventLocation Query Schemas
 *
 * Standardized query schemas for event location operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for event locations
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * EventLocation-specific filters that extend the base search functionality
 */
export const EventLocationFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),

    // Address filters
    streetAddress: z.string().optional(),
    postalCode: z.string().optional(),

    // Capacity filters
    minCapacity: z.number().int().min(0).optional(),
    maxCapacity: z.number().int().min(0).optional(),

    // Type/category filters
    locationType: z.string().optional(),
    venueType: z.string().optional(),

    // Features filters
    hasParking: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    isIndoor: z.boolean().optional(),
    isOutdoor: z.boolean().optional(),

    // Geographic radius search
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius: z.number().min(0).max(1000).optional(), // kilometers

    // Event-related filters
    hasUpcomingEvents: z.boolean().optional(),
    minEventsHosted: z.number().int().min(0).optional(),

    // Operating status
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional()
});
export type EventLocationFilters = z.infer<typeof EventLocationFiltersSchema>;

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete event location search schema combining base search with event location-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: EventLocation-specific filtering options
 */
export const EventLocationSearchSchema = BaseSearchSchema.extend({
    filters: EventLocationFiltersSchema.optional()
});
export type EventLocationSearchInput = z.infer<typeof EventLocationSearchSchema>;

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * EventLocation list item schema - contains essential fields for list display
 */
export const EventLocationListItemSchema = EventLocationSchema.pick({
    id: true,
    placeName: true,
    street: true,
    number: true,
    city: true,
    state: true,
    country: true,
    zipCode: true,
    coordinates: true,
    createdAt: true,
    updatedAt: true
});
export type EventLocationListItem = z.infer<typeof EventLocationListItemSchema>;

/**
 * EventLocation search result item - extends list item with search relevance score
 */
export const EventLocationSearchResultItemSchema = EventLocationListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});
export type EventLocationSearchResultItem = z.infer<typeof EventLocationSearchResultItemSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * EventLocation list response using standardized pagination format
 */
export const EventLocationListResponseSchema = PaginationResultSchema(EventLocationListItemSchema);
export type EventLocationListResponse = z.infer<typeof EventLocationListResponseSchema>;

/**
 * EventLocation search response using standardized pagination format with search results
 */
export const EventLocationSearchResponseSchema = PaginationResultSchema(
    EventLocationSearchResultItemSchema
);
export type EventLocationSearchResponse = z.infer<typeof EventLocationSearchResponseSchema>;

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * EventLocation summary schema for quick display
 */
export const EventLocationSummarySchema = EventLocationSchema.pick({
    id: true,
    placeName: true,
    street: true,
    city: true,
    state: true,
    country: true,
    coordinates: true
});
export type EventLocationSummary = z.infer<typeof EventLocationSummarySchema>;

/**
 * EventLocation statistics schema
 */
export const EventLocationStatsSchema = z.object({
    totalLocations: z.number().int().min(0).default(0),
    activeLocations: z.number().int().min(0).default(0),
    verifiedLocations: z.number().int().min(0).default(0),
    totalCapacity: z.number().int().min(0).default(0),
    averageCapacity: z.number().min(0).default(0),

    // Geographic distribution
    locationsByCountry: z.record(z.string(), z.number().int().min(0)).optional(),
    locationsByState: z.record(z.string(), z.number().int().min(0)).optional(),
    locationsByCity: z.record(z.string(), z.number().int().min(0)).optional(),

    // Type distribution
    locationsByType: z.record(z.string(), z.number().int().min(0)).optional(),

    // Feature statistics
    locationsWithParking: z.number().int().min(0).default(0),
    accessibleLocations: z.number().int().min(0).default(0),
    indoorLocations: z.number().int().min(0).default(0),
    outdoorLocations: z.number().int().min(0).default(0),

    // Recent activity
    locationsCreatedToday: z.number().int().min(0).default(0),
    locationsCreatedThisWeek: z.number().int().min(0).default(0),
    locationsCreatedThisMonth: z.number().int().min(0).default(0)
});
export type EventLocationStats = z.infer<typeof EventLocationStatsSchema>;

// Compatibility aliases for existing code
export type EventLocationListInput = EventLocationSearchInput;
export type EventLocationListOutput = EventLocationListResponse;
export type EventLocationSearchOutput = EventLocationSearchResponse;

// Additional compatibility schemas
const EventLocationCountInputInternalSchema = z.object({
    filters: EventLocationFiltersSchema.optional()
});
const EventLocationCountWrapperSchema = z.object({ count: z.number().int().min(0) });
export type EventLocationCountInput = z.infer<typeof EventLocationCountInputInternalSchema>;
export type EventLocationCountOutput = z.infer<typeof EventLocationCountWrapperSchema>;

// Legacy compatibility exports
export const EventLocationListInputSchema = EventLocationSearchSchema;
export const EventLocationListOutputSchema = EventLocationListResponseSchema;
export const EventLocationSearchInputSchema = EventLocationSearchSchema;
export const EventLocationSearchOutputSchema = EventLocationSearchResponseSchema;
export const EventLocationCountInputSchema = z.object({
    filters: EventLocationFiltersSchema.optional()
});
export const EventLocationCountOutputSchema = z.object({ count: z.number().int().min(0) });
