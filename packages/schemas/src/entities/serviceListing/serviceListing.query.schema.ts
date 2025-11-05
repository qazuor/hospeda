import { z } from 'zod';
import {
    ClientIdSchema,
    ServiceListingIdSchema,
    ServiceListingPlanIdSchema,
    TouristServiceIdSchema
} from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { ServiceListingStatusSchema } from '../../enums/index.js';

/**
 * ServiceListing Query Schemas
 *
 * This file contains all query-related schemas for service listings:
 * - List queries with filters and pagination
 * - Search queries
 * - Summary/statistics queries
 * - Filter-specific schemas
 */

// ============================================================================
// BASE FILTERS
// ============================================================================

/**
 * Base filters that can be applied to service listing queries
 */
export const ServiceListingBaseFiltersSchema = z.object({
    // Entity filters
    id: ServiceListingIdSchema.optional(),
    clientId: ClientIdSchema.optional(),
    touristServiceId: TouristServiceIdSchema.optional(),
    listingPlanId: ServiceListingPlanIdSchema.optional(),

    // Status filters
    status: ServiceListingStatusSchema.optional(),
    statuses: z.array(ServiceListingStatusSchema).optional(),

    // Boolean flags filters
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isTrialListing: z.boolean().optional(),

    // Price range filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),

    // Date filters
    publishedAfter: z.string().datetime().optional(),
    publishedBefore: z.string().datetime().optional(),
    expiresAfter: z.string().datetime().optional(),
    expiresBefore: z.string().datetime().optional(),
    trialStartAfter: z.string().datetime().optional(),
    trialStartBefore: z.string().datetime().optional(),

    // Text search
    q: z.string().optional()
});

export type ServiceListingBaseFilters = z.infer<typeof ServiceListingBaseFiltersSchema>;

// ============================================================================
// LIST QUERIES
// ============================================================================

/**
 * Schema for listing service listings with pagination and filters
 */
export const ServiceListingListQuerySchema = BaseSearchSchema.extend({
    ...ServiceListingBaseFiltersSchema.shape
});

export type ServiceListingListQuery = z.infer<typeof ServiceListingListQuerySchema>;

/**
 * Schema for service listing list response
 */
export const ServiceListingListResponseSchema = z.object({
    items: z.array(
        z.object({
            id: ServiceListingIdSchema,
            clientId: ClientIdSchema,
            touristServiceId: TouristServiceIdSchema,
            listingPlanId: ServiceListingPlanIdSchema,
            title: z.string(),
            description: z.string().optional(),
            basePrice: z.number().optional(),
            status: ServiceListingStatusSchema,
            isActive: z.boolean(),
            isFeatured: z.boolean(),
            isTrialListing: z.boolean(),
            publishedAt: z.string().datetime().optional().nullable(),
            expiresAt: z.string().datetime().optional().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime()
        })
    ),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type ServiceListingListResponse = z.infer<typeof ServiceListingListResponseSchema>;

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Schema for searching service listings
 */
export const ServiceListingSearchQuerySchema = z.object({
    q: z.string().min(1, { message: 'zodError.serviceListing.search.queryRequired' }),
    ...ServiceListingBaseFiltersSchema.omit({ q: true }).shape,
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type ServiceListingSearchQuery = z.infer<typeof ServiceListingSearchQuerySchema>;

// ============================================================================
// SUMMARY QUERIES
// ============================================================================

/**
 * Schema for service listing summary statistics
 */
export const ServiceListingSummaryQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    touristServiceId: TouristServiceIdSchema.optional(),
    listingPlanId: ServiceListingPlanIdSchema.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type ServiceListingSummaryQuery = z.infer<typeof ServiceListingSummaryQuerySchema>;

/**
 * Schema for service listing summary response
 */
export const ServiceListingSummaryResponseSchema = z.object({
    totalListings: z.number().int(),
    activeListings: z.number().int(),
    pausedListings: z.number().int(),
    draftListings: z.number().int(),
    expiredListings: z.number().int(),
    rejectedListings: z.number().int(),
    trialListings: z.number().int(),
    featuredListings: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
    averagePrice: z.number().optional(),
    totalRevenue: z.number().optional()
});

export type ServiceListingSummaryResponse = z.infer<typeof ServiceListingSummaryResponseSchema>;

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Schema for service listing statistics
 */
export const ServiceListingStatsQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    groupBy: z.enum(['status', 'plan', 'service', 'date', 'price_range']).default('status'),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
});

export type ServiceListingStatsQuery = z.infer<typeof ServiceListingStatsQuerySchema>;

/**
 * Schema for service listing statistics response
 */
export const ServiceListingStatsResponseSchema = z.object({
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

export type ServiceListingStatsResponse = z.infer<typeof ServiceListingStatsResponseSchema>;

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Schema for admin service listing queries (includes soft-deleted)
 */
export const ServiceListingAdminQuerySchema = ServiceListingListQuerySchema.extend({
    includeDeleted: z.boolean().default(false),
    deletedOnly: z.boolean().default(false)
});

export type ServiceListingAdminQuery = z.infer<typeof ServiceListingAdminQuerySchema>;
