import { z } from 'zod';

/**
 * Common API Query Schemas
 *
 * This file contains reusable schemas for API query parameters:
 * - Pagination
 * - Sorting
 * - Search
 * - Date ranges
 * - Price ranges
 * - Location queries
 */

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

/**
 * Schema for pagination query parameters
 * Used across all list endpoints for consistent pagination
 * Uses z.coerce for query string conversion
 */
export const PaginationQuerySchema = z.object({
    page: z.coerce
        .number({
            message: 'zodError.pagination.page.invalidType'
        })
        .int({ message: 'zodError.pagination.page.int' })
        .min(1, { message: 'zodError.pagination.page.min' })
        .default(1),
    pageSize: z.coerce
        .number({
            message: 'zodError.pagination.pageSize.invalidType'
        })
        .int({ message: 'zodError.pagination.pageSize.int' })
        .min(1, { message: 'zodError.pagination.pageSize.min' })
        .max(100, { message: 'zodError.pagination.pageSize.max' })
        .default(20)
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ============================================================================
// SORT SCHEMAS
// ============================================================================

/**
 * Schema for sorting query parameters
 * Used across all list endpoints for consistent sorting
 */
export const SortQuerySchema = z.object({
    sortBy: z
        .string({
            message: 'zodError.sort.sortBy.invalidType'
        })
        .min(1, { message: 'zodError.sort.sortBy.min' })
        .max(50, { message: 'zodError.sort.sortBy.max' })
        .optional(),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.sort.sortOrder.enum'
        })
        .optional()
        .default('asc'),
    orderBy: z
        .string({
            message: 'zodError.sort.orderBy.invalidType'
        })
        .min(1, { message: 'zodError.sort.orderBy.min' })
        .max(50, { message: 'zodError.sort.orderBy.max' })
        .optional(),
    order: z
        .enum(['asc', 'desc'], {
            message: 'zodError.sort.order.enum'
        })
        .optional()
        .default('asc')
});
export type SortQuery = z.infer<typeof SortQuerySchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for search query parameters
 * Used across all search endpoints for consistent search functionality
 */
export const SearchQuerySchema = z.object({
    q: z
        .string({
            message: 'zodError.search.q.invalidType'
        })
        .min(1, { message: 'zodError.search.q.min' })
        .max(200, { message: 'zodError.search.q.max' })
        .optional(),
    query: z
        .string({
            message: 'zodError.search.query.invalidType'
        })
        .min(1, { message: 'zodError.search.query.min' })
        .max(200, { message: 'zodError.search.query.max' })
        .optional(),
    search: z
        .string({
            message: 'zodError.search.search.invalidType'
        })
        .min(1, { message: 'zodError.search.search.min' })
        .max(200, { message: 'zodError.search.search.max' })
        .optional(),
    fuzzy: z
        .boolean({
            message: 'zodError.search.fuzzy.invalidType'
        })
        .optional()
        .default(false),
    exact: z
        .boolean({
            message: 'zodError.search.exact.invalidType'
        })
        .optional()
        .default(false),
    caseSensitive: z
        .boolean({
            message: 'zodError.search.caseSensitive.invalidType'
        })
        .optional()
        .default(false),
    fields: z
        .array(
            z.string({
                message: 'zodError.search.fields.item.invalidType'
            })
        )
        .optional(),
    highlight: z
        .boolean({
            message: 'zodError.search.highlight.invalidType'
        })
        .optional()
        .default(false)
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ============================================================================
// DATE RANGE SCHEMAS
// ============================================================================

/**
 * Schema for date range query parameters
 * Used for filtering by date ranges across all entities
 */
export const DateRangeQuerySchema = z
    .object({
        startDate: z
            .date({
                message: 'zodError.dateRange.startDate.invalidType'
            })
            .optional(),
        endDate: z
            .date({
                message: 'zodError.dateRange.endDate.invalidType'
            })
            .optional(),
        dateFrom: z
            .date({
                message: 'zodError.dateRange.dateFrom.invalidType'
            })
            .optional(),
        dateTo: z
            .date({
                message: 'zodError.dateRange.dateTo.invalidType'
            })
            .optional(),
        createdAfter: z
            .date({
                message: 'zodError.dateRange.createdAfter.invalidType'
            })
            .optional(),
        createdBefore: z
            .date({
                message: 'zodError.dateRange.createdBefore.invalidType'
            })
            .optional(),
        updatedAfter: z
            .date({
                message: 'zodError.dateRange.updatedAfter.invalidType'
            })
            .optional(),
        updatedBefore: z
            .date({
                message: 'zodError.dateRange.updatedBefore.invalidType'
            })
            .optional(),
        period: z
            .enum(
                [
                    'today',
                    'yesterday',
                    'last7days',
                    'last30days',
                    'last90days',
                    'thisMonth',
                    'lastMonth',
                    'thisYear',
                    'lastYear'
                ],
                {
                    message: 'zodError.dateRange.period.enum'
                }
            )
            .optional(),
        timeframe: z
            .enum(['hour', 'day', 'week', 'month', 'quarter', 'year'], {
                message: 'zodError.dateRange.timeframe.enum'
            })
            .optional()
    })
    .refine(
        (data) => {
            // Ensure startDate is before endDate if both are provided
            if (data.startDate && data.endDate) {
                return data.startDate <= data.endDate;
            }
            // Ensure dateFrom is before dateTo if both are provided
            if (data.dateFrom && data.dateTo) {
                return data.dateFrom <= data.dateTo;
            }
            // Ensure createdAfter is before createdBefore if both are provided
            if (data.createdAfter && data.createdBefore) {
                return data.createdAfter <= data.createdBefore;
            }
            // Ensure updatedAfter is before updatedBefore if both are provided
            if (data.updatedAfter && data.updatedBefore) {
                return data.updatedAfter <= data.updatedBefore;
            }
            return true;
        },
        {
            message: 'zodError.dateRange.invalidRange'
        }
    );
export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

// ============================================================================
// PRICE RANGE SCHEMAS
// ============================================================================

/**
 * Schema for price range query parameters
 * Used for filtering by price ranges across accommodations and other entities
 */
export const PriceRangeQuerySchema = z
    .object({
        minPrice: z
            .number({
                message: 'zodError.priceRange.minPrice.invalidType'
            })
            .min(0, { message: 'zodError.priceRange.minPrice.min' })
            .optional(),
        maxPrice: z
            .number({
                message: 'zodError.priceRange.maxPrice.invalidType'
            })
            .min(0, { message: 'zodError.priceRange.maxPrice.min' })
            .optional(),
        priceFrom: z
            .number({
                message: 'zodError.priceRange.priceFrom.invalidType'
            })
            .min(0, { message: 'zodError.priceRange.priceFrom.min' })
            .optional(),
        priceTo: z
            .number({
                message: 'zodError.priceRange.priceTo.invalidType'
            })
            .min(0, { message: 'zodError.priceRange.priceTo.min' })
            .optional(),
        currency: z
            .string({
                message: 'zodError.priceRange.currency.invalidType'
            })
            .length(3, { message: 'zodError.priceRange.currency.length' })
            .optional(),
        priceRange: z
            .enum(['budget', 'mid-range', 'luxury', 'ultra-luxury'], {
                message: 'zodError.priceRange.priceRange.enum'
            })
            .optional(),
        budgetLevel: z
            .enum(['low', 'medium', 'high', 'premium'], {
                message: 'zodError.priceRange.budgetLevel.enum'
            })
            .optional()
    })
    .refine(
        (data) => {
            // Ensure minPrice is less than maxPrice if both are provided
            if (data.minPrice !== undefined && data.maxPrice !== undefined) {
                return data.minPrice <= data.maxPrice;
            }
            // Ensure priceFrom is less than priceTo if both are provided
            if (data.priceFrom !== undefined && data.priceTo !== undefined) {
                return data.priceFrom <= data.priceTo;
            }
            return true;
        },
        {
            message: 'zodError.priceRange.invalidRange'
        }
    );
export type PriceRangeQuery = z.infer<typeof PriceRangeQuerySchema>;

// ============================================================================
// LOCATION QUERY SCHEMAS
// ============================================================================

/**
 * Schema for location-based query parameters
 * Used for filtering by location across accommodations, destinations, and events
 */
export const LocationQuerySchema = z
    .object({
        country: z
            .string({
                message: 'zodError.location.country.invalidType'
            })
            .min(2, { message: 'zodError.location.country.min' })
            .max(100, { message: 'zodError.location.country.max' })
            .optional(),
        state: z
            .string({
                message: 'zodError.location.state.invalidType'
            })
            .min(1, { message: 'zodError.location.state.min' })
            .max(100, { message: 'zodError.location.state.max' })
            .optional(),
        city: z
            .string({
                message: 'zodError.location.city.invalidType'
            })
            .min(1, { message: 'zodError.location.city.min' })
            .max(100, { message: 'zodError.location.city.max' })
            .optional(),
        region: z
            .string({
                message: 'zodError.location.region.invalidType'
            })
            .min(1, { message: 'zodError.location.region.min' })
            .max(100, { message: 'zodError.location.region.max' })
            .optional(),
        latitude: z
            .number({
                message: 'zodError.location.latitude.invalidType'
            })
            .min(-90, { message: 'zodError.location.latitude.min' })
            .max(90, { message: 'zodError.location.latitude.max' })
            .optional(),
        longitude: z
            .number({
                message: 'zodError.location.longitude.invalidType'
            })
            .min(-180, { message: 'zodError.location.longitude.min' })
            .max(180, { message: 'zodError.location.longitude.max' })
            .optional(),
        radius: z
            .number({
                message: 'zodError.location.radius.invalidType'
            })
            .min(0.1, { message: 'zodError.location.radius.min' })
            .max(1000, { message: 'zodError.location.radius.max' })
            .optional(),
        radiusUnit: z
            .enum(['km', 'miles'], {
                message: 'zodError.location.radiusUnit.enum'
            })
            .optional()
            .default('km'),
        bbox: z
            .array(z.number(), {
                message: 'zodError.location.bbox.invalidType'
            })
            .length(4, { message: 'zodError.location.bbox.length' })
            .optional(), // [minLng, minLat, maxLng, maxLat]
        near: z
            .string({
                message: 'zodError.location.near.invalidType'
            })
            .min(1, { message: 'zodError.location.near.min' })
            .max(200, { message: 'zodError.location.near.max' })
            .optional(), // "latitude,longitude" or place name
        within: z
            .string({
                message: 'zodError.location.within.invalidType'
            })
            .min(1, { message: 'zodError.location.within.min' })
            .max(100, { message: 'zodError.location.within.max' })
            .optional() // Administrative area name
    })
    .refine(
        (data) => {
            // If latitude is provided, longitude must also be provided
            if (data.latitude !== undefined && data.longitude === undefined) {
                return false;
            }
            // If longitude is provided, latitude must also be provided
            if (data.longitude !== undefined && data.latitude === undefined) {
                return false;
            }
            // If radius is provided, latitude and longitude must also be provided
            if (
                data.radius !== undefined &&
                (data.latitude === undefined || data.longitude === undefined)
            ) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.location.coordinatesRequired'
        }
    );
export type LocationQuery = z.infer<typeof LocationQuerySchema>;

// ============================================================================
// COMBINED QUERY SCHEMAS
// ============================================================================

/**
 * Base query schema combining common query parameters
 * Can be extended by specific entity query schemas
 */
export const BaseQuerySchema =
    PaginationQuerySchema.merge(SortQuerySchema).merge(SearchQuerySchema);
export type BaseQuery = z.infer<typeof BaseQuerySchema>;

/**
 * Extended query schema with date and location filters
 * For entities that need comprehensive filtering capabilities
 */
export const ExtendedQuerySchema =
    BaseQuerySchema.merge(DateRangeQuerySchema).merge(LocationQuerySchema);
export type ExtendedQuery = z.infer<typeof ExtendedQuerySchema>;

/**
 * Commerce query schema with price filtering
 * For entities related to commerce and pricing
 */
export const CommerceQuerySchema = ExtendedQuerySchema.merge(PriceRangeQuerySchema);
export type CommerceQuery = z.infer<typeof CommerceQuerySchema>;
