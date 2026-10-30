import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { PriceRangeEnumSchema, VenueTypeEnumSchema } from '../../enums/index.js';
import { VenueSchema } from './venue.schema.js';

/**
 * venue Query Schemas
 *
 * This file contains all schemas related to querying venue listings:
 * - Filters schema
 * - Search / list schema
 * - Summary schema
 * - Stats schema
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * venue-specific filter schema.
 * Used as a building block for search schemas.
 */
export const VenueFiltersSchema = z.object({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by venue sub-type. */
    type: VenueTypeEnumSchema.optional(),
    /** Filter by price-range tier. */
    priceRange: PriceRangeEnumSchema.optional(),
    /** Filter listings that have a given amenity. Accepts a list of amenity UUIDs. */
    amenities: z.array(z.string().uuid()).optional(),
    /** Filter listings that have a given feature. Accepts a list of feature UUIDs. */
    features: z.array(z.string().uuid()).optional(),
    /** Filter by featured status. */
    isFeatured: z.boolean().optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Minimum average rating (0–5). */
    minRating: z.number().min(0).max(5).optional(),
    /** Maximum average rating (0–5). */
    maxRating: z.number().min(0).max(5).optional(),
    /** Created after this date. */
    createdAfter: z.date().optional(),
    /** Created before this date. */
    createdBefore: z.date().optional()
});

/** TypeScript type for {@link VenueFiltersSchema}. */
export type VenueFilters = z.infer<typeof VenueFiltersSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard venue search schema.
 * Extends the platform base search with venue-specific filters.
 *
 * @example
 * ```ts
 * const results = venueSearchSchema.parse({
 *   q: 'parrilla',
 *   type: 'PARRILLA',
 *   priceRange: 'MID',
 *   page: 1,
 *   pageSize: 20,
 * });
 * ```
 */
export const VenueSearchSchema = BaseSearchSchema.extend({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by venue sub-type. */
    type: VenueTypeEnumSchema.optional(),
    /** Filter by price-range tier. */
    priceRange: PriceRangeEnumSchema.optional(),
    /** Filter listings that have all these amenity UUIDs. */
    amenities: z.array(z.string().uuid()).optional(),
    /** Filter listings that have all these feature UUIDs. */
    features: z.array(z.string().uuid()).optional(),
    /** Filter by featured status. */
    isFeatured: z.boolean().optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Minimum average rating (0–5). */
    minRating: z.number().min(0).max(5).optional(),
    /** Maximum average rating (0–5). */
    maxRating: z.number().min(0).max(5).optional(),
    /** Created after this date. */
    createdAfter: z.date().optional(),
    /** Created before this date. */
    createdBefore: z.date().optional(),
    /** Opt-in projection: include associated amenities in each result row. */
    includeAmenities: z.boolean().optional(),
    /** Opt-in projection: include associated features in each result row. */
    includeFeatures: z.boolean().optional()
});

/** TypeScript type for {@link VenueSearchSchema}. */
export type VenueSearch = z.infer<typeof VenueSearchSchema>;
/** Alias for {@link VenueSearch}. */
export type VenueSearchInput = VenueSearch;

/**
 * Standard venue search result schema.
 * Wraps an array of full venue schemas with pagination metadata.
 */
export const VenueSearchResultSchema = PaginationResultSchema(VenueSchema);

/** TypeScript type for {@link VenueSearchResultSchema}. */
export type VenueSearchResult = z.infer<typeof VenueSearchResultSchema>;

// ============================================================================
// LIST ITEM SCHEMA
// ============================================================================

/**
 * venue list item — public-safe minimal projection for listing pages.
 */
export const VenueListItemSchema = VenueSchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceRange: true,
    media: true,
    ownerId: true,
    destinationId: true,
    createdAt: true,
    updatedAt: true
}).extend({
    /** Featured state, derived from `featuredByEntitlement` (HOS-1419). */
    isFeatured: z.boolean().optional(),
    // Use `.default(0)` only — `.default().optional()` is a dead chain because
    // `.default()` already handles the absent-key case; adding `.optional()` after
    // it creates a ZodOptional(ZodDefault) where the outer optional is never reached.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link VenueListItemSchema}. */
export type VenueListItem = z.infer<typeof VenueListItemSchema>;

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * venue summary — essential fields for cards and relation selectors.
 */
export const VenueSummarySchema = VenueSchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceRange: true,
    media: true,
    ownerId: true,
    destinationId: true
}).extend({
    /** Featured state, derived from `featuredByEntitlement` (HOS-1419). */
    isFeatured: z.boolean().optional(),
    // Use `.default(0)` only — same rationale as venueListItemSchema above.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link VenueSummarySchema}. */
export type VenueSummary = z.infer<typeof VenueSummarySchema>;

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * venue statistics schema.
 * Used for admin dashboards and platform metrics.
 */
export const VenueStatsSchema = z.object({
    /** Total number of venue listings. */
    total: z.number(),
    /** Number of featured listings. */
    totalFeatured: z.number(),
    /** Average rating across all listings (optional, absent when no reviews exist). */
    averageRating: z.number().min(0).max(5).optional(),
    /** Count breakdown by sub-type. */
    totalByType: z.record(z.string(), z.number()),
    /** Count breakdown by price range. */
    totalByPriceRange: z.record(z.string(), z.number())
});

/** TypeScript type for {@link VenueStatsSchema}. */
export type VenueStats = z.infer<typeof VenueStatsSchema>;
