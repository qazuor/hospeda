import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { ClientTypeEnumSchema } from '../../enums/index.js';
import { PostSponsorSchema } from './postSponsor.schema.js';

/**
 * Post Sponsor Query Schemas
 *
 * Standardized query schemas for post sponsor operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for post sponsors
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Post sponsor-specific filters that extend the base search functionality
 */
export const PostSponsorFiltersSchema = z.object({
    // Text filters
    name: z.string().optional(),

    // Type filters
    type: ClientTypeEnumSchema.optional(),

    // Lifecycle filters
    lifecycleState: z.string().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Contact/presence filters
    hasLogo: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    hasDescription: z.boolean().optional(),

    // Social media presence filters
    hasTwitter: z.boolean().optional(),
    hasFacebook: z.boolean().optional(),
    hasInstagram: z.boolean().optional(),
    hasLinkedIn: z.boolean().optional(),

    // Text pattern filters
    nameContains: z.string().min(1).max(100).optional(),
    nameStartsWith: z.string().min(1).max(100).optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete post sponsor search schema combining base search with entity-specific filters.
 * FLAT PATTERN: All filters are at the top level for HTTP compatibility.
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const PostSponsorSearchSchema = BaseSearchSchema.extend({
    // Text filters
    name: z.string().optional(),

    // Type filters
    type: ClientTypeEnumSchema.optional(),

    // Lifecycle filters
    lifecycleState: z.string().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Contact/presence filters
    hasLogo: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    hasDescription: z.boolean().optional(),

    // Social media presence filters
    hasTwitter: z.boolean().optional(),
    hasFacebook: z.boolean().optional(),
    hasInstagram: z.boolean().optional(),
    hasLinkedIn: z.boolean().optional(),

    // Text pattern filters
    nameContains: z.string().min(1).max(100).optional(),
    nameStartsWith: z.string().min(1).max(100).optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Post sponsor list item schema - contains essential fields for list display
 */
export const PostSponsorListItemSchema = PostSponsorSchema.pick({
    id: true,
    name: true,
    type: true,
    description: true,
    logo: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Post sponsor search result item - extends list item with search relevance score
 */
export const PostSponsorSearchResultItemSchema = PostSponsorListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Post sponsor list response using standardized pagination format
 */
export const PostSponsorListResponseSchema = PaginationResultSchema(PostSponsorListItemSchema);

/**
 * Post sponsor search response using standardized pagination format with search results
 */
export const PostSponsorSearchResponseSchema = PaginationResultSchema(
    PostSponsorSearchResultItemSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Post sponsor summary schema for quick display
 */
export const PostSponsorSummarySchema = PostSponsorSchema.pick({
    id: true,
    name: true,
    type: true,
    logo: true,
    lifecycleState: true
});

/**
 * Post sponsor statistics schema
 */
export const PostSponsorStatsSchema = z.object({
    // Basic statistics
    totalSponsors: z.number().int().min(0).default(0),
    activeSponsors: z.number().int().min(0).default(0),

    // Type distribution
    typeDistribution: z
        .array(
            z.object({
                type: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional(),

    // Presence statistics
    withLogoCount: z.number().int().min(0).default(0),
    withWebsiteCount: z.number().int().min(0).default(0),

    // Recent activity
    sponsorsCreatedToday: z.number().int().min(0).default(0),
    sponsorsCreatedThisWeek: z.number().int().min(0).default(0),
    sponsorsCreatedThisMonth: z.number().int().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostSponsorFilters = z.infer<typeof PostSponsorFiltersSchema>;
export type PostSponsorQuerySearchInput = z.infer<typeof PostSponsorSearchSchema>;
export type PostSponsorListItem = z.infer<typeof PostSponsorListItemSchema>;
export type PostSponsorSearchResultItem = z.infer<typeof PostSponsorSearchResultItemSchema>;
export type PostSponsorListResponse = z.infer<typeof PostSponsorListResponseSchema>;
export type PostSponsorSearchResponse = z.infer<typeof PostSponsorSearchResponseSchema>;
export type PostSponsorSummary = z.infer<typeof PostSponsorSummarySchema>;
export type PostSponsorStats = z.infer<typeof PostSponsorStatsSchema>;

// Compatibility aliases for existing code
export type PostSponsorQueryListInput = PostSponsorQuerySearchInput;
export type PostSponsorQueryListOutput = PostSponsorListResponse;
export type PostSponsorQuerySearchOutput = PostSponsorSearchResponse;
export type PostSponsorQuerySearchResult = PostSponsorSearchResultItem;

// Legacy compatibility exports
export const PostSponsorQuerySearchInputSchema = PostSponsorSearchSchema;
export const PostSponsorQuerySearchOutputSchema = PostSponsorSearchResponseSchema;
export const PostSponsorQueryListInputSchema = PostSponsorSearchSchema;
export const PostSponsorQueryListOutputSchema = PostSponsorListResponseSchema;
