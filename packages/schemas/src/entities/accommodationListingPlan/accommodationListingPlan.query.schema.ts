import { z } from 'zod';
import { AccommodationListingPlanIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';

/**
 * AccommodationListingPlan Query Schemas
 *
 * This file contains all query-related schemas for accommodation listing plans:
 * - List queries with filters and pagination
 * - Search queries
 * - Summary/statistics queries
 * - Filter-specific schemas
 */

// ============================================================================
// BASE FILTERS
// ============================================================================

/**
 * Base filters that can be applied to accommodation listing plan queries
 */
export const AccommodationListingPlanBaseFiltersSchema = z.object({
    // Entity filters
    id: AccommodationListingPlanIdSchema.optional(),

    // Name filters
    name: z.string().optional(),
    nameContains: z.string().optional(),

    // Plan features filters (search within limits JSON)
    hasFeature: z.string().optional(),
    featureValue: z.string().optional(),

    // Text search
    q: z.string().optional()
});

export type AccommodationListingPlanBaseFilters = z.infer<
    typeof AccommodationListingPlanBaseFiltersSchema
>;

// ============================================================================
// LIST QUERIES
// ============================================================================

/**
 * Schema for listing accommodation listing plans with pagination and filters
 */
export const AccommodationListingPlanListQuerySchema = BaseSearchSchema.extend({
    ...AccommodationListingPlanBaseFiltersSchema.shape
});

export type AccommodationListingPlanListQuery = z.infer<
    typeof AccommodationListingPlanListQuerySchema
>;

/**
 * Schema for accommodation listing plan list response
 */
export const AccommodationListingPlanListResponseSchema = z.object({
    items: z.array(
        z.object({
            id: AccommodationListingPlanIdSchema,
            name: z.string(),
            limits: z.record(z.string(), z.unknown()).optional(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime()
        })
    ),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type AccommodationListingPlanListResponse = z.infer<
    typeof AccommodationListingPlanListResponseSchema
>;

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Schema for searching accommodation listing plans
 */
export const AccommodationListingPlanSearchQuerySchema = z.object({
    q: z.string().min(1, { message: 'zodError.accommodationListingPlan.search.queryRequired' }),
    ...AccommodationListingPlanBaseFiltersSchema.omit({ q: true }).shape,
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type AccommodationListingPlanSearchQuery = z.infer<
    typeof AccommodationListingPlanSearchQuerySchema
>;

// ============================================================================
// SUMMARY QUERIES
// ============================================================================

/**
 * Schema for accommodation listing plan summary statistics
 */
export const AccommodationListingPlanSummaryQuerySchema = z.object({
    includeLimitsBreakdown: z.boolean().default(false)
});

export type AccommodationListingPlanSummaryQuery = z.infer<
    typeof AccommodationListingPlanSummaryQuerySchema
>;

/**
 * Schema for accommodation listing plan summary response
 */
export const AccommodationListingPlanSummaryResponseSchema = z.object({
    totalPlans: z.number().int(),
    activePlans: z.number().int(),
    featuresBreakdown: z.record(z.string(), z.number().int()).optional(),
    mostUsedFeatures: z
        .array(
            z.object({
                feature: z.string(),
                count: z.number().int()
            })
        )
        .optional()
});

export type AccommodationListingPlanSummaryResponse = z.infer<
    typeof AccommodationListingPlanSummaryResponseSchema
>;

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Schema for accommodation listing plan statistics
 */
export const AccommodationListingPlanStatsQuerySchema = z.object({
    groupBy: z.enum(['usage', 'features', 'created']).default('usage')
});

export type AccommodationListingPlanStatsQuery = z.infer<
    typeof AccommodationListingPlanStatsQuerySchema
>;

/**
 * Schema for accommodation listing plan statistics response
 */
export const AccommodationListingPlanStatsResponseSchema = z.object({
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

export type AccommodationListingPlanStatsResponse = z.infer<
    typeof AccommodationListingPlanStatsResponseSchema
>;

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Schema for admin accommodation listing plan queries (includes soft-deleted)
 */
export const AccommodationListingPlanAdminQuerySchema =
    AccommodationListingPlanListQuerySchema.extend({
        includeDeleted: z.boolean().default(false),
        deletedOnly: z.boolean().default(false)
    });

export type AccommodationListingPlanAdminQuery = z.infer<
    typeof AccommodationListingPlanAdminQuerySchema
>;
