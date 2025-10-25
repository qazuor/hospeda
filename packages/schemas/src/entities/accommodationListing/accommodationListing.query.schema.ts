import { z } from 'zod';
import {
    AccommodationIdSchema,
    AccommodationListingIdSchema,
    AccommodationListingPlanIdSchema,
    ClientIdSchema
} from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { ListingStatusSchema } from '../../enums/index.js';

/**
 * AccommodationListing Query Schemas
 *
 * This file contains all query-related schemas for accommodation listings:
 * - List queries with filters and pagination
 * - Search queries
 * - Summary/statistics queries
 * - Filter-specific schemas
 */

// ============================================================================
// BASE FILTERS
// ============================================================================

/**
 * Base filters that can be applied to accommodation listing queries
 */
export const AccommodationListingBaseFiltersSchema = z.object({
    // Entity filters
    id: AccommodationListingIdSchema.optional(),
    clientId: ClientIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    listingPlanId: AccommodationListingPlanIdSchema.optional(),

    // Status filters
    status: ListingStatusSchema.optional(),
    statuses: z.array(ListingStatusSchema).optional(),

    // Trial filters
    isTrial: z.boolean().optional(),
    isActiveOnly: z.boolean().optional(),

    // Date filters
    fromDateAfter: z.string().datetime().optional(),
    fromDateBefore: z.string().datetime().optional(),
    toDateAfter: z.string().datetime().optional(),
    toDateBefore: z.string().datetime().optional(),

    // Location filters (for related accommodation)
    destinationId: z.string().uuid().optional(),
    city: z.string().optional(),
    country: z.string().optional(),

    // Text search
    q: z.string().optional()
});

export type AccommodationListingBaseFilters = z.infer<typeof AccommodationListingBaseFiltersSchema>;

// ============================================================================
// LIST QUERIES
// ============================================================================

/**
 * Schema for listing accommodation listings with pagination and filters
 */
export const AccommodationListingListQuerySchema = BaseSearchSchema.extend({
    ...AccommodationListingBaseFiltersSchema.shape
});

export type AccommodationListingListQuery = z.infer<typeof AccommodationListingListQuerySchema>;

/**
 * Schema for accommodation listing list response
 */
export const AccommodationListingListResponseSchema = z.object({
    items: z.array(
        z.object({
            id: AccommodationListingIdSchema,
            clientId: ClientIdSchema,
            accommodationId: AccommodationIdSchema,
            listingPlanId: AccommodationListingPlanIdSchema,
            fromDate: z.string().datetime(),
            toDate: z.string().datetime(),
            trialEndsAt: z.string().datetime().optional(),
            isTrial: z.boolean(),
            status: ListingStatusSchema,
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime()
        })
    ),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type AccommodationListingListResponse = z.infer<
    typeof AccommodationListingListResponseSchema
>;

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Schema for searching accommodation listings
 */
export const AccommodationListingSearchQuerySchema = z.object({
    q: z.string().min(1, { message: 'zodError.accommodationListing.search.queryRequired' }),
    ...AccommodationListingBaseFiltersSchema.omit({ q: true }).shape,
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type AccommodationListingSearchQuery = z.infer<typeof AccommodationListingSearchQuerySchema>;

// ============================================================================
// SUMMARY QUERIES
// ============================================================================

/**
 * Schema for accommodation listing summary statistics
 */
export const AccommodationListingSummaryQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type AccommodationListingSummaryQuery = z.infer<
    typeof AccommodationListingSummaryQuerySchema
>;

/**
 * Schema for accommodation listing summary response
 */
export const AccommodationListingSummaryResponseSchema = z.object({
    totalListings: z.number().int(),
    activeListings: z.number().int(),
    pausedListings: z.number().int(),
    archivedListings: z.number().int(),
    trialListings: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
    byPlan: z.record(z.string(), z.number().int())
});

export type AccommodationListingSummaryResponse = z.infer<
    typeof AccommodationListingSummaryResponseSchema
>;

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Schema for accommodation listing statistics
 */
export const AccommodationListingStatsQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    groupBy: z.enum(['status', 'plan', 'date', 'accommodation']).default('status'),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type AccommodationListingStatsQuery = z.infer<typeof AccommodationListingStatsQuerySchema>;

/**
 * Schema for accommodation listing statistics response
 */
export const AccommodationListingStatsResponseSchema = z.object({
    groupBy: z.string(),
    items: z.array(
        z.object({
            key: z.string(),
            value: z.number().int(),
            percentage: z.number()
        })
    ),
    totalCount: z.number().int()
});

export type AccommodationListingStatsResponse = z.infer<
    typeof AccommodationListingStatsResponseSchema
>;

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Schema for admin accommodation listing queries (includes soft-deleted)
 */
export const AccommodationListingAdminQuerySchema = AccommodationListingListQuerySchema.extend({
    includeDeleted: z.boolean().default(false),
    deletedOnly: z.boolean().default(false)
});

export type AccommodationListingAdminQuery = z.infer<typeof AccommodationListingAdminQuerySchema>;
