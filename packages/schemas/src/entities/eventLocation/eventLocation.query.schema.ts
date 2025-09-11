import { z } from 'zod';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * EventLocation Query Schemas
 *
 * This file contains all schemas related to querying event locations:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for event location-specific filters
 * Used in list and search operations
 */
export const EventLocationFiltersSchema = z.object({
    // Location filters
    city: z
        .string({
            message: 'zodError.eventLocation.filters.city.invalidType'
        })
        .min(1, { message: 'zodError.eventLocation.filters.city.min' })
        .optional(),

    state: z
        .string({
            message: 'zodError.eventLocation.filters.state.invalidType'
        })
        .min(1, { message: 'zodError.eventLocation.filters.state.min' })
        .optional(),

    country: z
        .string({
            message: 'zodError.eventLocation.filters.country.invalidType'
        })
        .min(1, { message: 'zodError.eventLocation.filters.country.min' })
        .optional(),

    // Free text search across multiple fields
    q: z
        .string({
            message: 'zodError.eventLocation.filters.q.invalidType'
        })
        .min(1, { message: 'zodError.eventLocation.filters.q.min' })
        .optional()
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for event location search input
 * Combines base search functionality with event location-specific filters
 */
export const EventLocationSearchInputSchema = BaseSearchSchema.extend({
    filters: EventLocationFiltersSchema.optional()
});

/**
 * Schema for event location search output
 * Returns paginated list of event locations
 */
export const EventLocationSearchOutputSchema = z.object({
    items: z.array(EventLocationSchema),
    total: z
        .number({
            message: 'zodError.eventLocation.search.total.invalidType'
        })
        .int({ message: 'zodError.eventLocation.search.total.int' })
        .min(0, { message: 'zodError.eventLocation.search.total.min' }),
    page: z
        .number({
            message: 'zodError.eventLocation.search.page.invalidType'
        })
        .int({ message: 'zodError.eventLocation.search.page.int' })
        .min(1, { message: 'zodError.eventLocation.search.page.min' }),
    pageSize: z
        .number({
            message: 'zodError.eventLocation.search.pageSize.invalidType'
        })
        .int({ message: 'zodError.eventLocation.search.pageSize.int' })
        .min(1, { message: 'zodError.eventLocation.search.pageSize.min' }),
    hasNextPage: z.boolean({
        message: 'zodError.eventLocation.search.hasNextPage.invalidType'
    }),
    hasPreviousPage: z.boolean({
        message: 'zodError.eventLocation.search.hasPreviousPage.invalidType'
    })
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for event location list input
 * Simplified version for basic listing with pagination and filters
 */
export const EventLocationListInputSchema = z.object({
    filters: EventLocationFiltersSchema.optional(),
    page: z
        .number({
            message: 'zodError.eventLocation.list.page.invalidType'
        })
        .int({ message: 'zodError.eventLocation.list.page.int' })
        .min(1, { message: 'zodError.eventLocation.list.page.min' })
        .optional()
        .default(1),
    pageSize: z
        .number({
            message: 'zodError.eventLocation.list.pageSize.invalidType'
        })
        .int({ message: 'zodError.eventLocation.list.pageSize.int' })
        .min(1, { message: 'zodError.eventLocation.list.pageSize.min' })
        .max(100, { message: 'zodError.eventLocation.list.pageSize.max' })
        .optional()
        .default(10)
});

/**
 * Schema for event location list output
 * Returns simple list with total count
 */
export const EventLocationListOutputSchema = z.object({
    items: z.array(EventLocationSchema),
    total: z
        .number({
            message: 'zodError.eventLocation.list.total.invalidType'
        })
        .int({ message: 'zodError.eventLocation.list.total.int' })
        .min(0, { message: 'zodError.eventLocation.list.total.min' })
});

// ============================================================================
// COUNT SCHEMAS
// ============================================================================

/**
 * Schema for event location count input
 * Uses same filters as search but without pagination
 */
export const EventLocationCountInputSchema = z.object({
    filters: EventLocationFiltersSchema.optional()
});

/**
 * Schema for event location count output
 * Returns simple count
 */
export const EventLocationCountOutputSchema = z.object({
    count: z
        .number({
            message: 'zodError.eventLocation.count.count.invalidType'
        })
        .int({ message: 'zodError.eventLocation.count.count.int' })
        .min(0, { message: 'zodError.eventLocation.count.count.min' })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventLocationFilters = z.infer<typeof EventLocationFiltersSchema>;
export type EventLocationSearchInput = z.infer<typeof EventLocationSearchInputSchema>;
export type EventLocationSearchOutput = z.infer<typeof EventLocationSearchOutputSchema>;
export type EventLocationListInput = z.infer<typeof EventLocationListInputSchema>;
export type EventLocationListOutput = z.infer<typeof EventLocationListOutputSchema>;
export type EventLocationCountInput = z.infer<typeof EventLocationCountInputSchema>;
export type EventLocationCountOutput = z.infer<typeof EventLocationCountOutputSchema>;
