import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { EventOrganizerSchema } from './eventOrganizer.schema.js';

/**
 * EventOrganizer Query Schemas
 *
 * Standardized query schemas for event organizer operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for event organizers
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * EventOrganizer-specific filters that extend the base search functionality
 */
export const EventOrganizerFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),

    // Contact information filters (for filtering by nested contact info)
    personalEmail: z.string().email().optional(),
    workEmail: z.string().email().optional(),
    mobilePhone: z.string().optional(),
    website: z.string().url().optional(),

    // Lifecycle filter (this exists in main schema)
    lifecycleState: z.string().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete event organizer search schema combining base search with event organizer-specific filters
 * MIGRATED TO FLAT PATTERN: All filters are at the top level for HTTP compatibility
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const EventOrganizerSearchSchema = BaseSearchSchema.extend({
    // Basic filters (flattened from EventOrganizerFiltersSchema)
    name: z.string().optional(),

    // Contact information filters (for filtering by nested contact info)
    personalEmail: z.string().email().optional(),
    workEmail: z.string().email().optional(),
    mobilePhone: z.string().optional(),
    website: z.string().url().optional(),

    // Lifecycle filter (this exists in main schema)
    lifecycleState: z.string().optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * EventOrganizer list item schema - contains essential fields for list display
 */
export const EventOrganizerListItemSchema = EventOrganizerSchema.pick({
    id: true,
    name: true,
    description: true,
    logo: true,
    contactInfo: true,
    socialNetworks: true,
    createdAt: true,
    updatedAt: true,
    lifecycleState: true,
    adminInfo: true
});

/**
 * EventOrganizer search result item - extends list item with search relevance score
 */
export const EventOrganizerSearchResultItemSchema = EventOrganizerListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * EventOrganizer list response using standardized pagination format
 */
export const EventOrganizerListResponseSchema = PaginationResultSchema(
    EventOrganizerListItemSchema
);

/**
 * EventOrganizer search response using standardized pagination format with search results
 */
export const EventOrganizerSearchResponseSchema = PaginationResultSchema(
    EventOrganizerSearchResultItemSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * EventOrganizer summary schema for quick display
 */
export const EventOrganizerSummarySchema = EventOrganizerSchema.pick({
    id: true,
    name: true,
    description: true,
    logo: true,
    email: true,
    website: true,
    city: true,
    state: true,
    country: true,
    organizerType: true,
    isActive: true,
    isVerified: true
});

/**
 * EventOrganizer statistics schema
 */
export const EventOrganizerStatsSchema = z.object({
    totalOrganizers: z.number().int().min(0).default(0),
    activeOrganizers: z.number().int().min(0).default(0),
    verifiedOrganizers: z.number().int().min(0).default(0),
    partnerOrganizers: z.number().int().min(0).default(0),

    // Type distribution
    organizersByType: z.record(z.string(), z.number().int().min(0)).optional(),

    // Geographic distribution
    organizersByCountry: z.record(z.string(), z.number().int().min(0)).optional(),
    organizersByState: z.record(z.string(), z.number().int().min(0)).optional(),
    organizersByCity: z.record(z.string(), z.number().int().min(0)).optional(),

    // Content statistics
    organizersWithLogo: z.number().int().min(0).default(0),
    organizersWithDescription: z.number().int().min(0).default(0),
    organizersWithWebsite: z.number().int().min(0).default(0),
    organizersWithSocialMedia: z.number().int().min(0).default(0),

    // Event statistics
    totalEventsOrganized: z.number().int().min(0).default(0),
    averageEventsPerOrganizer: z.number().min(0).default(0),

    // Recent activity
    organizersCreatedToday: z.number().int().min(0).default(0),
    organizersCreatedThisWeek: z.number().int().min(0).default(0),
    organizersCreatedThisMonth: z.number().int().min(0).default(0),

    // Top organizers
    topOrganizersByEvents: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                eventCount: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventOrganizerFilters = z.infer<typeof EventOrganizerFiltersSchema>;
export type EventOrganizerSearchInput = z.infer<typeof EventOrganizerSearchSchema>;
export type EventOrganizerListItem = z.infer<typeof EventOrganizerListItemSchema>;
export type EventOrganizerSearchResultItem = z.infer<typeof EventOrganizerSearchResultItemSchema>;
export type EventOrganizerListResponse = z.infer<typeof EventOrganizerListResponseSchema>;
export type EventOrganizerSearchResponse = z.infer<typeof EventOrganizerSearchResponseSchema>;
export type EventOrganizerSummary = z.infer<typeof EventOrganizerSummarySchema>;
export type EventOrganizerStats = z.infer<typeof EventOrganizerStatsSchema>;

// Compatibility aliases for existing code
export type EventOrganizerListInput = EventOrganizerSearchInput;
export type EventOrganizerListOutput = EventOrganizerListResponse;
export type EventOrganizerSearchOutput = EventOrganizerSearchResponse;
export type EventOrganizerSearchResult = EventOrganizerSearchResultItem;

// Additional compatibility schemas
const EventOrganizerCountInputInternalSchema = z.object({
    filters: EventOrganizerFiltersSchema.optional()
});
const EventOrganizerCountWrapperSchema = z.object({ count: z.number().int().min(0) });
export type EventOrganizerCountInput = z.infer<typeof EventOrganizerCountInputInternalSchema>;
export type EventOrganizerCountOutput = z.infer<typeof EventOrganizerCountWrapperSchema>;

// Legacy compatibility exports
export const EventOrganizerListInputSchema = EventOrganizerSearchSchema;
export const EventOrganizerListOutputSchema = EventOrganizerListResponseSchema;
export const EventOrganizerSearchInputSchema = EventOrganizerSearchSchema;
export const EventOrganizerSearchOutputSchema = EventOrganizerSearchResponseSchema;
export const EventOrganizerCountInputSchema = z.object({
    filters: EventOrganizerFiltersSchema.optional()
});
export const EventOrganizerCountOutputSchema = z.object({ count: z.number().int().min(0) });

// Additional missing legacy exports
export const EventOrganizerSearchResultSchema = EventOrganizerSearchResponseSchema;
export const EventOrganizerStatsParamsSchema = z.object({
    organizerId: z.string().uuid()
});
export const EventOrganizerSummaryParamsSchema = z.object({
    organizerId: z.string().uuid()
});

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS & OPENAPI METADATA
// ============================================================================

export const HttpEventOrganizerSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    q: z.string().optional(),
    name: z.string().optional(),
    isVerified: HttpQueryFields.isVerified(),
    isActive: HttpQueryFields.isActive(),
    minEventsCount: HttpQueryFields.minEventsCount(),
    city: z.string().optional(),
    country: z.string().length(2).optional()
});

export const EVENT_ORGANIZER_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'EventOrganizerSearch',
    description: 'Schema for searching event organizers',
    title: 'Event Organizer Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        q: 'conference organizer',
        isVerified: true,
        minEventsCount: 5
    },
    fields: {
        q: { description: 'Search query', example: 'conference organizer' },
        isVerified: { description: 'Filter verified organizers', example: true },
        minEventsCount: { description: 'Minimum events organized', example: 5 }
    },
    tags: ['event-organizers', 'search']
};

export const EventOrganizerSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpEventOrganizerSearchSchema,
    EVENT_ORGANIZER_SEARCH_METADATA
);
