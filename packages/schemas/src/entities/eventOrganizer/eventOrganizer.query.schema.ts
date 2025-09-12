import { z } from 'zod';
import { EventOrganizerIdParamsSchema } from '../../common/params.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { EventOrganizerSchema } from './eventOrganizer.schema.js';

/**
 * EventOrganizer Query Schemas
 *
 * This file contains all schemas related to querying event organizers:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Count
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for event organizer-specific filters
 * Used in list and search operations
 */
export const EventOrganizerFiltersSchema = z.object({
    // Basic filters
    name: z
        .string({
            message: 'zodError.eventOrganizer.filters.name.invalidType'
        })
        .min(1, { message: 'zodError.eventOrganizer.filters.name.min' })
        .optional(),

    // General search query
    q: z
        .string({
            message: 'zodError.eventOrganizer.filters.q.invalidType'
        })
        .min(1, { message: 'zodError.eventOrganizer.filters.q.min' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for listing event organizers with pagination and filters
 */
export const EventOrganizerListInputSchema = PaginationSchema.extend({
    filters: EventOrganizerFiltersSchema.optional()
});

/**
 * Schema for event organizer list items
 * Simplified version for list display
 */
export const EventOrganizerListItemSchema = EventOrganizerSchema.pick({
    id: true,
    name: true,
    description: true,
    logo: true,
    createdAt: true,
    updatedAt: true,
    lifecycleState: true
});

/**
 * Schema for event organizer list response
 */
export const EventOrganizerListOutputSchema = z.object({
    items: z.array(EventOrganizerListItemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0)
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching event organizers
 * Extends base search with event organizer-specific filters
 */
export const EventOrganizerSearchInputSchema = BaseSearchSchema.extend({
    filters: EventOrganizerFiltersSchema.optional()
});

/**
 * Schema for event organizer search results
 * Same as list item but could be extended with search-specific fields
 */
export const EventOrganizerSearchResultSchema = EventOrganizerListItemSchema;

/**
 * Schema for event organizer search response
 */
export const EventOrganizerSearchOutputSchema = z.object({
    items: z.array(EventOrganizerSearchResultSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0),
    query: z.string().optional()
});

// ============================================================================
// COUNT SCHEMAS
// ============================================================================

/**
 * Schema for counting event organizers
 */
export const EventOrganizerCountInputSchema = z.object({
    filters: EventOrganizerFiltersSchema.optional()
});

/**
 * Schema for event organizer count response
 */
export const EventOrganizerCountOutputSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for event organizer summary parameters
 * Reuses generic ID params
 */
export const EventOrganizerSummaryParamsSchema = EventOrganizerIdParamsSchema;

/**
 * Schema for event organizer stats parameters
 * Reuses generic ID params
 */
export const EventOrganizerStatsParamsSchema = EventOrganizerIdParamsSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventOrganizerFilters = z.infer<typeof EventOrganizerFiltersSchema>;
export type EventOrganizerListInput = z.infer<typeof EventOrganizerListInputSchema>;
export type EventOrganizerListItem = z.infer<typeof EventOrganizerListItemSchema>;
export type EventOrganizerListOutput = z.infer<typeof EventOrganizerListOutputSchema>;
export type EventOrganizerSearchInput = z.infer<typeof EventOrganizerSearchInputSchema>;
export type EventOrganizerSearchResult = z.infer<typeof EventOrganizerSearchResultSchema>;
export type EventOrganizerSearchOutput = z.infer<typeof EventOrganizerSearchOutputSchema>;
export type EventOrganizerCountInput = z.infer<typeof EventOrganizerCountInputSchema>;
export type EventOrganizerCountOutput = z.infer<typeof EventOrganizerCountOutputSchema>;
export type EventOrganizerSummaryParams = z.infer<typeof EventOrganizerSummaryParamsSchema>;
export type EventOrganizerStatsParams = z.infer<typeof EventOrganizerStatsParamsSchema>;
