import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { SponsorshipStatusEnumSchema } from '../../enums/sponsorship-status.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';
import { SponsorshipSchema } from './sponsorship.schema.js';

/**
 * Sponsorship Query Schemas
 *
 * Standardized query schemas for sponsorship operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for sponsorships
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Sponsorship-specific filters that extend the base search functionality
 */
export const SponsorshipFiltersSchema = z.object({
    // Relationship filters
    sponsorUserId: z.string().uuid().optional(),
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    targetId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),

    // Status filters
    status: SponsorshipStatusEnumSchema.optional(),

    // Date range filters for startsAt
    startsAtAfter: z.date().optional(),
    startsAtBefore: z.date().optional(),

    // Date range filters for endsAt
    endsAtAfter: z.date().optional(),
    endsAtBefore: z.date().optional(),

    // Date range filters for createdAt
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Coupon filters
    hasCouponCode: z.boolean().optional(),
    minCouponDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxCouponDiscountPercent: z.number().int().min(0).max(100).optional(),

    // Analytics filters
    minImpressions: z.number().int().min(0).optional(),
    maxImpressions: z.number().int().min(0).optional(),
    minClicks: z.number().int().min(0).optional(),
    maxClicks: z.number().int().min(0).optional(),

    // Presence filters
    hasLogoUrl: z.boolean().optional(),
    hasLinkUrl: z.boolean().optional(),
    hasPaymentId: z.boolean().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete sponsorship search schema combining base search with entity-specific filters.
 * FLAT PATTERN: All filters are at the top level for HTTP compatibility.
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const SponsorshipQuerySchema = BaseSearchSchema.extend({
    // Relationship filters
    sponsorUserId: z.string().uuid().optional(),
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    targetId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),

    // Status filters
    status: SponsorshipStatusEnumSchema.optional(),

    // Date range filters for startsAt
    startsAtAfter: z.date().optional(),
    startsAtBefore: z.date().optional(),

    // Date range filters for endsAt
    endsAtAfter: z.date().optional(),
    endsAtBefore: z.date().optional(),

    // Date range filters for createdAt
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Coupon filters
    hasCouponCode: z.boolean().optional(),
    minCouponDiscountPercent: z.number().int().min(0).max(100).optional(),
    maxCouponDiscountPercent: z.number().int().min(0).max(100).optional(),

    // Analytics filters
    minImpressions: z.number().int().min(0).optional(),
    maxImpressions: z.number().int().min(0).optional(),
    minClicks: z.number().int().min(0).optional(),
    maxClicks: z.number().int().min(0).optional(),

    // Presence filters
    hasLogoUrl: z.boolean().optional(),
    hasLinkUrl: z.boolean().optional(),
    hasPaymentId: z.boolean().optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Sponsorship list item schema - contains essential fields for list display
 */
export const SponsorshipListItemSchema = SponsorshipSchema.pick({
    id: true,
    slug: true,
    sponsorUserId: true,
    targetType: true,
    targetId: true,
    levelId: true,
    status: true,
    startsAt: true,
    endsAt: true,
    couponCode: true,
    logoUrl: true,
    linkUrl: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Sponsorship search result item - extends list item with search relevance score
 */
export const SponsorshipSearchResultItemSchema = SponsorshipListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Sponsorship list response using standardized pagination format
 */
export const SponsorshipListResponseSchema = PaginationResultSchema(SponsorshipListItemSchema);

/**
 * Sponsorship search response using standardized pagination format with search results
 */
export const SponsorshipSearchResponseSchema = PaginationResultSchema(
    SponsorshipSearchResultItemSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Sponsorship summary schema for quick display
 */
export const SponsorshipSummarySchema = SponsorshipSchema.pick({
    id: true,
    slug: true,
    sponsorUserId: true,
    targetType: true,
    targetId: true,
    status: true,
    startsAt: true,
    endsAt: true
});

/**
 * Sponsorship statistics schema
 */
export const SponsorshipStatsSchema = z.object({
    // Basic statistics
    totalSponsorships: z.number().int().min(0).default(0),
    activeSponsorships: z.number().int().min(0).default(0),
    pendingSponsorships: z.number().int().min(0).default(0),
    expiredSponsorships: z.number().int().min(0).default(0),
    cancelledSponsorships: z.number().int().min(0).default(0),

    // Target type distribution
    targetTypeDistribution: z
        .object({
            event: z.number().int().min(0).default(0),
            post: z.number().int().min(0).default(0)
        })
        .optional(),

    // Coupon statistics
    sponsorshipsWithCoupons: z.number().int().min(0).default(0),
    averageCouponDiscount: z.number().min(0).default(0),

    // Analytics totals
    totalImpressions: z.number().int().min(0).default(0),
    totalClicks: z.number().int().min(0).default(0),
    totalCouponsUsed: z.number().int().min(0).default(0),

    // Recent activity
    sponsorshipsCreatedToday: z.number().int().min(0).default(0),
    sponsorshipsCreatedThisWeek: z.number().int().min(0).default(0),
    sponsorshipsCreatedThisMonth: z.number().int().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SponsorshipFilters = z.infer<typeof SponsorshipFiltersSchema>;
export type SponsorshipQuerySearchInput = z.infer<typeof SponsorshipQuerySchema>;
export type SponsorshipListItem = z.infer<typeof SponsorshipListItemSchema>;
export type SponsorshipSearchResultItem = z.infer<typeof SponsorshipSearchResultItemSchema>;
export type SponsorshipListResponse = z.infer<typeof SponsorshipListResponseSchema>;
export type SponsorshipSearchResponse = z.infer<typeof SponsorshipSearchResponseSchema>;
export type SponsorshipSummary = z.infer<typeof SponsorshipSummarySchema>;
export type SponsorshipStats = z.infer<typeof SponsorshipStatsSchema>;

// Compatibility aliases for existing code
export type SponsorshipListInput = SponsorshipQuerySearchInput;
export type SponsorshipListOutput = SponsorshipListResponse;
export type SponsorshipQuerySearchOutput = SponsorshipSearchResponse;
export type SponsorshipQuerySearchResult = SponsorshipSearchResultItem;

// Legacy compatibility exports
export const SponsorshipListInputSchema = SponsorshipQuerySchema;
export const SponsorshipListOutputSchema = SponsorshipListResponseSchema;
export const SponsorshipQuerySearchInputSchema = SponsorshipQuerySchema;
export const SponsorshipQuerySearchOutputSchema = SponsorshipSearchResponseSchema;
