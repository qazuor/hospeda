import { z } from 'zod';
import {
    AccommodationIdSchema,
    ClientIdSchema,
    FeaturedAccommodationIdSchema
} from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { FeaturedStatusSchema, FeaturedTypeSchema } from '../../enums/index.js';

/**
 * FeaturedAccommodation Query Schemas
 *
 * This file contains all query-related schemas for featured accommodations:
 * - List queries with filters and pagination
 * - Search queries
 * - Summary/statistics queries
 * - Filter-specific schemas
 */

// ============================================================================
// BASE FILTERS
// ============================================================================

/**
 * Base filters that can be applied to featured accommodation queries
 */
export const FeaturedAccommodationBaseFiltersSchema = z.object({
    // Entity filters
    id: FeaturedAccommodationIdSchema.optional(),
    clientId: ClientIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),

    // Featured configuration filters
    featuredType: FeaturedTypeSchema.optional(),
    featuredTypes: z.array(FeaturedTypeSchema).optional(),

    // Status filters
    status: FeaturedStatusSchema.optional(),
    statuses: z.array(FeaturedStatusSchema).optional(),

    // Active status filter
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

export type FeaturedAccommodationBaseFilters = z.infer<
    typeof FeaturedAccommodationBaseFiltersSchema
>;

// ============================================================================
// LIST QUERIES
// ============================================================================

/**
 * Schema for listing featured accommodations with pagination and filters
 */
export const FeaturedAccommodationListQuerySchema = BaseSearchSchema.extend({
    ...FeaturedAccommodationBaseFiltersSchema.shape
});

export type FeaturedAccommodationListQuery = z.infer<typeof FeaturedAccommodationListQuerySchema>;

/**
 * Schema for featured accommodation list response
 */
export const FeaturedAccommodationListResponseSchema = z.object({
    items: z.array(
        z.object({
            id: FeaturedAccommodationIdSchema,
            clientId: ClientIdSchema,
            accommodationId: AccommodationIdSchema,
            featuredType: FeaturedTypeSchema,
            fromDate: z.string().datetime(),
            toDate: z.string().datetime(),
            status: FeaturedStatusSchema,
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime()
        })
    ),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type FeaturedAccommodationListResponse = z.infer<
    typeof FeaturedAccommodationListResponseSchema
>;

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Schema for searching featured accommodations
 */
export const FeaturedAccommodationSearchQuerySchema = z.object({
    q: z.string().min(1, { message: 'zodError.featuredAccommodation.search.queryRequired' }),
    ...FeaturedAccommodationBaseFiltersSchema.omit({ q: true }).shape,
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type FeaturedAccommodationSearchQuery = z.infer<
    typeof FeaturedAccommodationSearchQuerySchema
>;

// ============================================================================
// SUMMARY QUERIES
// ============================================================================

/**
 * Schema for featured accommodation summary statistics
 */
export const FeaturedAccommodationSummaryQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    featuredType: FeaturedTypeSchema.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type FeaturedAccommodationSummaryQuery = z.infer<
    typeof FeaturedAccommodationSummaryQuerySchema
>;

/**
 * Schema for featured accommodation summary response
 */
export const FeaturedAccommodationSummaryResponseSchema = z.object({
    totalFeatured: z.number().int(),
    activeFeatured: z.number().int(),
    pausedFeatured: z.number().int(),
    expiredFeatured: z.number().int(),
    cancelledFeatured: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
    byType: z.record(z.string(), z.number().int())
});

export type FeaturedAccommodationSummaryResponse = z.infer<
    typeof FeaturedAccommodationSummaryResponseSchema
>;

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Schema for featured accommodation statistics
 */
export const FeaturedAccommodationStatsQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    groupBy: z.enum(['status', 'type', 'date', 'accommodation']).default('status'),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type FeaturedAccommodationStatsQuery = z.infer<typeof FeaturedAccommodationStatsQuerySchema>;

/**
 * Schema for featured accommodation statistics response
 */
export const FeaturedAccommodationStatsResponseSchema = z.object({
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

export type FeaturedAccommodationStatsResponse = z.infer<
    typeof FeaturedAccommodationStatsResponseSchema
>;

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Schema for admin featured accommodation queries (includes soft-deleted)
 */
export const FeaturedAccommodationAdminQuerySchema = FeaturedAccommodationListQuerySchema.extend({
    includeDeleted: z.boolean().default(false),
    deletedOnly: z.boolean().default(false)
});

export type FeaturedAccommodationAdminQuery = z.infer<typeof FeaturedAccommodationAdminQuerySchema>;
