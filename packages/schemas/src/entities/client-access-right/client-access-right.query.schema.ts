import { z } from 'zod';
import { ClientIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { AccessRightScopeEnumSchema } from '../../enums/access-right-scope.schema.js';
import { ClientAccessRightSchema } from './client-access-right.schema.js';

/**
 * ClientAccessRight Query Schemas
 *
 * This file contains all schemas related to querying client access rights:
 * - Search: paginated search with filters
 * - List: simple list without pagination metadata
 * - Filters: client access right-specific filters
 * - Summary: lightweight client access right representation
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for client access right-specific filters
 */
export const ClientAccessRightFiltersSchema = z.object({
    // Basic filters
    clientId: ClientIdSchema.optional(),
    feature: z.string().min(1).optional(),
    scope: AccessRightScopeEnumSchema.optional(),
    scopeType: z.string().min(1).optional(),

    // Status filters
    isActive: z.boolean().optional(), // Based on validity period
    isExpired: z.boolean().optional(),

    // Date range filters
    validFromAfter: z.coerce.date().optional(),
    validFromBefore: z.coerce.date().optional(),
    validToAfter: z.coerce.date().optional(),
    validToBefore: z.coerce.date().optional(),

    // Text search
    q: z.string().min(1).optional()
});

// Type: Filters
export type ClientAccessRightFilters = z.infer<typeof ClientAccessRightFiltersSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for client access right search input
 * Extends BaseSearchSchema with client access right-specific filters
 */
export const ClientAccessRightSearchInputSchema = BaseSearchSchema.extend({
    filters: ClientAccessRightFiltersSchema.optional()
});

// Type: Search Input
export type ClientAccessRightSearchInput = z.infer<typeof ClientAccessRightSearchInputSchema>;

/**
 * Schema for client access right search results
 * Returns paginated results with metadata
 */
export const ClientAccessRightSearchOutputSchema = PaginationResultSchema(ClientAccessRightSchema);

// Type: Search Output
export type ClientAccessRightSearchOutput = z.infer<typeof ClientAccessRightSearchOutputSchema>;

// ============================================================================
// SUMMARY SCHEMAS
// ============================================================================

/**
 * Schema for client access right summary (lightweight version)
 * Contains essential information for listings and dropdowns
 */
export const ClientAccessRightSummarySchema = ClientAccessRightSchema.pick({
    id: true,
    clientId: true,
    feature: true,
    scope: true,
    scopeId: true,
    scopeType: true,
    validFrom: true,
    validTo: true
}).extend({
    // Computed fields for summary
    isActive: z.boolean(),
    isExpired: z.boolean(),
    daysUntilExpiration: z.number().int().nullable() // null if no expiration
});

// Type: Summary
export type ClientAccessRightSummary = z.infer<typeof ClientAccessRightSummarySchema>;

/**
 * Schema for client access right list results (summaries)
 * Returns array of summaries without pagination metadata
 */
export const ClientAccessRightListOutputSchema = z.array(ClientAccessRightSummarySchema);

// Type: List Output
export type ClientAccessRightListOutput = z.infer<typeof ClientAccessRightListOutputSchema>;

// ============================================================================
// STATS SCHEMAS
// ============================================================================

/**
 * Schema for client access right statistics
 * Provides aggregated data for dashboards and reporting
 */
export const ClientAccessRightStatsSchema = z.object({
    total: z.number().int().min(0),
    active: z.number().int().min(0),
    expired: z.number().int().min(0),
    expiringIn30Days: z.number().int().min(0),

    // By scope
    byScope: z.record(
        z.nativeEnum({
            ACCOMMODATION: 'accommodation',
            PLACEMENT: 'placement',
            MERCHANT: 'merchant',
            SERVICE: 'service',
            GLOBAL: 'global'
        }),
        z.number().int().min(0)
    ),

    // By feature
    topFeatures: z
        .array(
            z.object({
                feature: z.string(),
                count: z.number().int().min(0)
            })
        )
        .max(10),

    // Recent activity
    recentlyCreated: z.number().int().min(0), // Last 7 days
    recentlyExpired: z.number().int().min(0) // Last 7 days
});

// Type: Stats
export type ClientAccessRightStats = z.infer<typeof ClientAccessRightStatsSchema>;

// ============================================================================
// ADVANCED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for client access right advanced search
 * Includes complex filters and sorting options
 */
export const ClientAccessRightAdvancedSearchSchema = ClientAccessRightSearchInputSchema.extend({
    // Additional advanced filters
    includeExpired: z.boolean().default(false),
    includeInactive: z.boolean().default(false),

    // Multiple value filters
    clientIds: z.array(ClientIdSchema).max(100).optional(),
    features: z.array(z.string().min(1)).max(50).optional(),
    scopes: z.array(AccessRightScopeEnumSchema).optional(),

    // Complex date filters
    expiringWithinDays: z.number().int().min(1).max(365).optional(),
    createdWithinDays: z.number().int().min(1).max(365).optional(),

    // Sorting enhancements
    groupBy: z.enum(['client', 'feature', 'scope', 'expiration']).optional()
});

// Type: Advanced Search
export type ClientAccessRightAdvancedSearch = z.infer<typeof ClientAccessRightAdvancedSearchSchema>;

/**
 * Schema for grouped results (when using groupBy)
 */
export const ClientAccessRightGroupedResultsSchema = z.object({
    groups: z.array(
        z.object({
            key: z.string(), // The grouping key value
            label: z.string(), // Human-readable label
            count: z.number().int().min(0),
            items: z.array(ClientAccessRightSchema)
        })
    ),
    totalGroups: z.number().int().min(0),
    totalItems: z.number().int().min(0)
});

// Type: Grouped Results
export type ClientAccessRightGroupedResults = z.infer<typeof ClientAccessRightGroupedResultsSchema>;
