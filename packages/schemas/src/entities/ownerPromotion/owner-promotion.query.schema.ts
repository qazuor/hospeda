import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';
import { OwnerPromotionSchema } from './owner-promotion.schema.js';

/**
 * Owner Promotion Query Schemas
 *
 * Standardized query schemas for owner promotion operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for owner promotions
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Owner promotion-specific filters that extend the base search functionality
 */
export const OwnerPromotionFiltersSchema = z.object({
    // Relationship filters
    ownerId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),

    // Type filters
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),

    // Status filters
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Date range filters for validFrom
    validFromAfter: z.date().optional(),
    validFromBefore: z.date().optional(),

    // Date range filters for validUntil
    validUntilAfter: z.date().optional(),
    validUntilBefore: z.date().optional(),

    // Date range filters for createdAt
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Discount value range filters
    minDiscountValue: z.number().min(0).optional(),
    maxDiscountValue: z.number().min(0).optional(),

    // Redemption filters
    hasMaxRedemptions: z.boolean().optional(),
    minCurrentRedemptions: z.number().int().min(0).optional(),
    maxCurrentRedemptions: z.number().int().min(0).optional(),

    // Night filters
    minMinNights: z.number().int().min(1).optional(),
    maxMinNights: z.number().int().min(1).optional(),

    // Text pattern filters
    titleContains: z.string().min(1).max(100).optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete owner promotion search schema combining base search with entity-specific filters.
 * FLAT PATTERN: All filters are at the top level for HTTP compatibility.
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const OwnerPromotionQuerySchema = BaseSearchSchema.extend({
    // Relationship filters
    ownerId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),

    // Type filters
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),

    // Status filters
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Date range filters for validFrom
    validFromAfter: z.date().optional(),
    validFromBefore: z.date().optional(),

    // Date range filters for validUntil
    validUntilAfter: z.date().optional(),
    validUntilBefore: z.date().optional(),

    // Date range filters for createdAt
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Discount value range filters
    minDiscountValue: z.number().min(0).optional(),
    maxDiscountValue: z.number().min(0).optional(),

    // Redemption filters
    hasMaxRedemptions: z.boolean().optional(),
    minCurrentRedemptions: z.number().int().min(0).optional(),
    maxCurrentRedemptions: z.number().int().min(0).optional(),

    // Night filters
    minMinNights: z.number().int().min(1).optional(),
    maxMinNights: z.number().int().min(1).optional(),

    // Text pattern filters
    titleContains: z.string().min(1).max(100).optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Owner promotion list item schema - contains essential fields for list display
 */
export const OwnerPromotionListItemSchema = OwnerPromotionSchema.pick({
    id: true,
    slug: true,
    ownerId: true,
    accommodationId: true,
    title: true,
    discountType: true,
    discountValue: true,
    lifecycleState: true,
    validFrom: true,
    validUntil: true,
    currentRedemptions: true,
    maxRedemptions: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Owner promotion search result item - extends list item with search relevance score
 */
export const OwnerPromotionSearchResultItemSchema = OwnerPromotionListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Owner promotion list response using standardized pagination format
 */
export const OwnerPromotionListResponseSchema = PaginationResultSchema(
    OwnerPromotionListItemSchema
);

/**
 * Owner promotion search response using standardized pagination format with search results
 */
export const OwnerPromotionSearchResponseSchema = PaginationResultSchema(
    OwnerPromotionSearchResultItemSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Owner promotion summary schema for quick display
 */
export const OwnerPromotionSummarySchema = OwnerPromotionSchema.pick({
    id: true,
    slug: true,
    title: true,
    discountType: true,
    discountValue: true,
    lifecycleState: true,
    validFrom: true,
    validUntil: true
});

/**
 * Owner promotion statistics schema
 */
export const OwnerPromotionStatsSchema = z.object({
    // Basic statistics
    totalPromotions: z.number().int().min(0).default(0),
    activePromotions: z.number().int().min(0).default(0),
    expiredPromotions: z.number().int().min(0).default(0),

    // Discount type distribution
    discountTypeDistribution: z
        .object({
            percentage: z.number().int().min(0).default(0),
            fixed: z.number().int().min(0).default(0),
            free_night: z.number().int().min(0).default(0)
        })
        .optional(),

    // Redemption statistics
    totalRedemptions: z.number().int().min(0).default(0),
    averageRedemptionsPerPromotion: z.number().min(0).default(0),

    // Recent activity
    promotionsCreatedToday: z.number().int().min(0).default(0),
    promotionsCreatedThisWeek: z.number().int().min(0).default(0),
    promotionsCreatedThisMonth: z.number().int().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type OwnerPromotionFilters = z.infer<typeof OwnerPromotionFiltersSchema>;
export type OwnerPromotionQuerySearchInput = z.infer<typeof OwnerPromotionQuerySchema>;
export type OwnerPromotionListItem = z.infer<typeof OwnerPromotionListItemSchema>;
export type OwnerPromotionSearchResultItem = z.infer<typeof OwnerPromotionSearchResultItemSchema>;
export type OwnerPromotionListResponse = z.infer<typeof OwnerPromotionListResponseSchema>;
export type OwnerPromotionSearchResponse = z.infer<typeof OwnerPromotionSearchResponseSchema>;
export type OwnerPromotionSummary = z.infer<typeof OwnerPromotionSummarySchema>;
export type OwnerPromotionStats = z.infer<typeof OwnerPromotionStatsSchema>;

// Compatibility aliases for existing code
export type OwnerPromotionListInput = OwnerPromotionQuerySearchInput;
export type OwnerPromotionListOutput = OwnerPromotionListResponse;
export type OwnerPromotionSearchOutput = OwnerPromotionSearchResponse;
export type OwnerPromotionSearchResult = OwnerPromotionSearchResultItem;

// Legacy compatibility exports
export const OwnerPromotionListInputSchema = OwnerPromotionQuerySchema;
export const OwnerPromotionListOutputSchema = OwnerPromotionListResponseSchema;
export const OwnerPromotionQuerySearchInputSchema = OwnerPromotionQuerySchema;
export const OwnerPromotionQuerySearchOutputSchema = OwnerPromotionSearchResponseSchema;
