import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * Destination Query Schemas
 *
 * This file contains all schemas related to querying destinations:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Summary
 * - Stats
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for destination-specific filters
 * Used in list and search operations
 */
export const DestinationFiltersSchema = z.object({
    // Basic filters
    isFeatured: z
        .boolean({
            message: 'zodError.destination.filters.isFeatured.invalidType'
        })
        .optional(),

    // Location filters
    country: z
        .string({
            message: 'zodError.destination.filters.country.invalidType'
        })
        .min(2, { message: 'zodError.destination.filters.country.min' })
        .max(2, { message: 'zodError.destination.filters.country.max' })
        .optional(),

    state: z
        .string({
            message: 'zodError.destination.filters.state.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.state.min' })
        .max(100, { message: 'zodError.destination.filters.state.max' })
        .optional(),

    city: z
        .string({
            message: 'zodError.destination.filters.city.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.city.min' })
        .max(100, { message: 'zodError.destination.filters.city.max' })
        .optional(),

    // Location radius search
    latitude: z
        .number({
            message: 'zodError.destination.filters.latitude.invalidType'
        })
        .min(-90, { message: 'zodError.destination.filters.latitude.min' })
        .max(90, { message: 'zodError.destination.filters.latitude.max' })
        .optional(),

    longitude: z
        .number({
            message: 'zodError.destination.filters.longitude.invalidType'
        })
        .min(-180, { message: 'zodError.destination.filters.longitude.min' })
        .max(180, { message: 'zodError.destination.filters.longitude.max' })
        .optional(),

    radius: z
        .number({
            message: 'zodError.destination.filters.radius.invalidType'
        })
        .min(0, { message: 'zodError.destination.filters.radius.min' })
        .max(1000, { message: 'zodError.destination.filters.radius.max' })
        .optional(),

    // Accommodation count filters
    minAccommodations: z
        .number({
            message: 'zodError.destination.filters.minAccommodations.invalidType'
        })
        .int({ message: 'zodError.destination.filters.minAccommodations.int' })
        .min(0, { message: 'zodError.destination.filters.minAccommodations.min' })
        .optional(),

    maxAccommodations: z
        .number({
            message: 'zodError.destination.filters.maxAccommodations.invalidType'
        })
        .int({ message: 'zodError.destination.filters.maxAccommodations.int' })
        .min(0, { message: 'zodError.destination.filters.maxAccommodations.min' })
        .optional(),

    // Rating filter
    minRating: z
        .number({
            message: 'zodError.destination.filters.minRating.invalidType'
        })
        .min(0, { message: 'zodError.destination.filters.minRating.min' })
        .max(5, { message: 'zodError.destination.filters.minRating.max' })
        .optional(),

    // Tags filter
    tags: z
        .array(z.string().uuid({ message: 'zodError.destination.filters.tags.item.uuid' }))
        .optional(),

    // Attractions filter
    hasAttractions: z
        .boolean({
            message: 'zodError.destination.filters.hasAttractions.invalidType'
        })
        .optional(),

    // Climate/season filters
    climate: z
        .string({
            message: 'zodError.destination.filters.climate.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.climate.min' })
        .max(50, { message: 'zodError.destination.filters.climate.max' })
        .optional(),

    bestSeason: z
        .string({
            message: 'zodError.destination.filters.bestSeason.invalidType'
        })
        .min(1, { message: 'zodError.destination.filters.bestSeason.min' })
        .max(50, { message: 'zodError.destination.filters.bestSeason.max' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for destination list input parameters
 * Includes pagination and filters
 */
export const DestinationListInputSchema = PaginationSchema.extend({
    filters: DestinationFiltersSchema.optional()
});

/**
 * Schema for individual destination items in lists
 * Contains essential fields for list display
 */
export const DestinationListItemSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    location: true,
    media: true,
    rating: true,
    accommodationsCount: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for destination list output
 * Uses generic paginated response with list items
 */
export const DestinationListOutputSchema = z.object({
    items: z.array(DestinationListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for destination search input parameters
 * Extends base search with destination-specific filters
 */
export const DestinationSearchInputSchema = BaseSearchSchema.extend({
    filters: DestinationFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.destination.search.query.invalidType'
        })
        .min(1, { message: 'zodError.destination.search.query.min' })
        .max(100, { message: 'zodError.destination.search.query.max' })
        .optional()
});

/**
 * Schema for individual destination search results
 * Extends list item with search score
 */
export const DestinationSearchResultSchema = DestinationListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.destination.search.score.invalidType'
        })
        .min(0, { message: 'zodError.destination.search.score.min' })
        .max(1, { message: 'zodError.destination.search.score.max' })
        .optional()
});

/**
 * Schema for destination search output
 * Uses generic paginated response with search results
 */
export const DestinationSearchOutputSchema = z.object({
    items: z.array(DestinationSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0)
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for destination summary
 * Contains essential information for quick display
 * Matches DestinationSummaryType from @repo/types
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

/**
 * Schema for destination summary with additional fields
 * Extended version with more fields for different use cases
 */
export const DestinationSummaryExtendedSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    isFeatured: true,
    location: true,
    media: true,
    rating: true,
    accommodationsCount: true,
    averageRating: true,
    reviewsCount: true
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for destination statistics
 * Contains basic metrics that match what the service actually returns
 */
export const DestinationStatsSchema = z.object({
    accommodationsCount: z
        .number({
            message: 'zodError.destination.stats.accommodationsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.accommodationsCount.int' })
        .min(0, { message: 'zodError.destination.stats.accommodationsCount.min' })
        .default(0),

    reviewsCount: z
        .number({
            message: 'zodError.destination.stats.reviewsCount.invalidType'
        })
        .int({ message: 'zodError.destination.stats.reviewsCount.int' })
        .min(0, { message: 'zodError.destination.stats.reviewsCount.min' })
        .default(0),

    averageRating: z
        .number({
            message: 'zodError.destination.stats.averageRating.invalidType'
        })
        .min(0, { message: 'zodError.destination.stats.averageRating.min' })
        .max(5, { message: 'zodError.destination.stats.averageRating.max' })
        .default(0)
});

// ============================================================================
// SERVICE-SPECIFIC INPUT SCHEMAS
// ============================================================================

/**
 * Schema for destination filter input (used by service)
 * Combines filters with pagination for service layer
 */
export const DestinationFilterInputSchema = z.object({
    filters: DestinationFiltersSchema.optional(),
    pagination: z
        .object({
            page: z.number().int().min(1).optional().default(1),
            pageSize: z.number().int().min(1).max(100).optional().default(10)
        })
        .optional()
});

/**
 * Schema for getting destination accommodations
 * Supports both legacy destinationId and new id parameter
 */
export const GetDestinationAccommodationsInputSchema = z
    .object({
        destinationId: DestinationIdSchema.optional(),
        id: DestinationIdSchema.optional()
    })
    .refine((data) => data.destinationId || data.id, {
        message: 'Either destinationId or id must be provided'
    });

/**
 * Schema for getting destination stats
 */
export const GetDestinationStatsInputSchema = z.object({
    destinationId: DestinationIdSchema
});

/**
 * Schema for getting destination summary
 */
export const GetDestinationSummaryInputSchema = z.object({
    destinationId: DestinationIdSchema
});

// ============================================================================
// SPECIALIZED OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for destination list item with attractions as strings
 * Used by searchForList method
 */
export const DestinationListItemWithStringAttractionsSchema = DestinationListItemSchema.omit({
    // Remove any attraction-related fields if they exist
}).extend({
    attractions: z.array(z.string()).optional()
});

/**
 * Schema for searchForList output
 */
export const DestinationSearchForListOutputSchema = z.object({
    items: z.array(DestinationListItemWithStringAttractionsSchema),
    total: z.number().int().min(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationFilters = z.infer<typeof DestinationFiltersSchema>;
export type DestinationFilterInput = z.infer<typeof DestinationFilterInputSchema>;
export type DestinationListInput = z.infer<typeof DestinationListInputSchema>;
export type DestinationListItem = z.infer<typeof DestinationListItemSchema>;
export type DestinationListOutput = z.infer<typeof DestinationListOutputSchema>;
export type DestinationSearchInput = z.infer<typeof DestinationSearchInputSchema>;
export type DestinationSearchResult = z.infer<typeof DestinationSearchResultSchema>;
export type DestinationSearchOutput = z.infer<typeof DestinationSearchOutputSchema>;
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;
export type DestinationSummaryExtended = z.infer<typeof DestinationSummaryExtendedSchema>;
export type DestinationStats = z.infer<typeof DestinationStatsSchema>;

// Service-specific types
export type GetDestinationAccommodationsInput = z.infer<
    typeof GetDestinationAccommodationsInputSchema
>;
export type GetDestinationStatsInput = z.infer<typeof GetDestinationStatsInputSchema>;
export type GetDestinationSummaryInput = z.infer<typeof GetDestinationSummaryInputSchema>;
export type DestinationListItemWithStringAttractions = z.infer<
    typeof DestinationListItemWithStringAttractionsSchema
>;
export type DestinationSearchForListOutput = z.infer<typeof DestinationSearchForListOutputSchema>;

// Compatibility alias for existing code
export type DestinationSummaryType = DestinationSummary;
