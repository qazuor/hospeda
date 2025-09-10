import { z } from 'zod';
import { AttractionIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';
import { AttractionSchema, AttractionSummarySchema } from './attraction.schema.js';

/**
 * Query and Search Schemas for Attraction operations
 */

/**
 * Schema for attraction search filters
 * Contains all possible filter criteria for searching attractions
 */
export const AttractionFiltersSchema = z.object({
    name: z.string().optional(),

    slug: z.string().optional(),

    isFeatured: z.boolean().optional(),

    isBuiltin: z.boolean().optional(),

    destinationId: DestinationIdSchema.optional(),

    lifecycleState: LifecycleStatusEnumSchema.optional(),

    q: z.string().min(1, { message: 'zodError.attraction.filters.q.min' }).optional()
});

/**
 * Schema for attraction search input
 * Combines filters with pagination and sorting
 */
export const AttractionSearchInputSchema = BaseSearchSchema.extend({
    filters: AttractionFiltersSchema.optional()
});

/**
 * Schema for attraction list input (simpler than search)
 * Used for basic listing with pagination only
 */
export const AttractionListInputSchema = z.object({
    pagination: PaginationSchema.optional()
});

/**
 * Schema for getting attractions by destination
 */
export const AttractionsByDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pagination: PaginationSchema.optional()
});

/**
 * Schema for getting destinations by attraction
 */
export const DestinationsByAttractionInputSchema = z.object({
    attractionId: AttractionIdSchema,
    pagination: PaginationSchema.optional()
});

/**
 * Query Output Schemas
 */

/**
 * Schema for attraction search results
 * Returns attractions with pagination info
 */
export const AttractionSearchOutputSchema = z.object({
    items: z.array(AttractionSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
    totalPages: z.number().int().min(0).optional()
});

/**
 * Schema for attraction list results (basic listing)
 * Returns attractions with total count
 */
export const AttractionListOutputSchema = z.object({
    items: z.array(AttractionSummarySchema),
    total: z.number().int().min(0)
});

/**
 * Schema for attraction list with destination counts
 * Used by searchForList method that includes destination counts
 */
export const AttractionWithDestinationCountSchema = AttractionSchema.extend({
    destinationCount: z.number().int().min(0).optional()
});

export const AttractionListWithCountsOutputSchema = z.object({
    items: z.array(AttractionWithDestinationCountSchema),
    total: z.number().int().min(0)
});

/**
 * Schema for attractions by destination results
 */
export const AttractionsByDestinationOutputSchema = z.object({
    attractions: z.array(AttractionSchema)
});

/**
 * Schema for destinations by attraction results
 * Note: This imports DestinationType from @repo/types since we don't have destination schema here
 */
export const DestinationsByAttractionOutputSchema = z.object({
    destinations: z.array(z.unknown()) // Will be typed as DestinationType[] in the service
});

/**
 * Schema for attraction count results
 */
export const AttractionCountOutputSchema = z.object({
    count: z.number().int().min(0)
});

/**
 * Schema for attraction statistics
 * Provides aggregate information about attractions
 */
export const AttractionStatsSchema = z.object({
    total: z.number().int().min(0),
    featured: z.number().int().min(0),
    builtin: z.number().int().min(0),
    byDestination: z.record(z.string(), z.number().int().min(0)).optional()
});

export const AttractionStatsOutputSchema = z.object({
    stats: AttractionStatsSchema.nullable()
});

/**
 * Type exports for query operations
 */
export type AttractionFilters = z.infer<typeof AttractionFiltersSchema>;
export type AttractionSearchInput = z.infer<typeof AttractionSearchInputSchema>;
export type AttractionListInput = z.infer<typeof AttractionListInputSchema>;
export type AttractionsByDestinationInput = z.infer<typeof AttractionsByDestinationInputSchema>;
export type DestinationsByAttractionInput = z.infer<typeof DestinationsByAttractionInputSchema>;

export type AttractionSearchOutput = z.infer<typeof AttractionSearchOutputSchema>;
export type AttractionListOutput = z.infer<typeof AttractionListOutputSchema>;
export type AttractionWithDestinationCount = z.infer<typeof AttractionWithDestinationCountSchema>;
export type AttractionListWithCountsOutput = z.infer<typeof AttractionListWithCountsOutputSchema>;
export type AttractionsByDestinationOutput = z.infer<typeof AttractionsByDestinationOutputSchema>;
export type DestinationsByAttractionOutput = z.infer<typeof DestinationsByAttractionOutputSchema>;
export type AttractionCountOutput = z.infer<typeof AttractionCountOutputSchema>;
export type AttractionStats = z.infer<typeof AttractionStatsSchema>;
export type AttractionStatsOutput = z.infer<typeof AttractionStatsOutputSchema>;
