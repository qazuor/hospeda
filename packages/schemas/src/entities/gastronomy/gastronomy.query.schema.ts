import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { GastronomyTypeEnumSchema, PriceRangeEnumSchema } from '../../enums/index.js';
import { GastronomySchema } from './gastronomy.schema.js';

/**
 * Gastronomy Query Schemas
 *
 * This file contains all schemas related to querying gastronomy listings:
 * - Filters schema
 * - Search / list schema
 * - Summary schema
 * - Stats schema
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Gastronomy-specific filter schema.
 * Used as a building block for search schemas.
 */
export const GastronomyFiltersSchema = z.object({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by gastronomy sub-type. */
    type: GastronomyTypeEnumSchema.optional(),
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

/** TypeScript type for {@link GastronomyFiltersSchema}. */
export type GastronomyFilters = z.infer<typeof GastronomyFiltersSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard gastronomy search schema.
 * Extends the platform base search with gastronomy-specific filters.
 *
 * @example
 * ```ts
 * const results = GastronomySearchSchema.parse({
 *   q: 'parrilla',
 *   type: 'PARRILLA',
 *   priceRange: 'MID',
 *   page: 1,
 *   pageSize: 20,
 * });
 * ```
 */
export const GastronomySearchSchema = BaseSearchSchema.extend({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by gastronomy sub-type. */
    type: GastronomyTypeEnumSchema.optional(),
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

/** TypeScript type for {@link GastronomySearchSchema}. */
export type GastronomySearch = z.infer<typeof GastronomySearchSchema>;
/** Alias for {@link GastronomySearch}. */
export type GastronomySearchInput = GastronomySearch;

/**
 * Standard gastronomy search result schema.
 * Wraps an array of full gastronomy schemas with pagination metadata.
 */
export const GastronomySearchResultSchema = PaginationResultSchema(GastronomySchema);

/** TypeScript type for {@link GastronomySearchResultSchema}. */
export type GastronomySearchResult = z.infer<typeof GastronomySearchResultSchema>;

// ============================================================================
// LIST ITEM SCHEMA
// ============================================================================

/**
 * Gastronomy list item — public-safe minimal projection for listing pages.
 */
export const GastronomyListItemSchema = GastronomySchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceRange: true,
    media: true,
    isFeatured: true,
    ownerId: true,
    destinationId: true,
    createdAt: true,
    updatedAt: true
}).extend({
    // Use `.default(0)` only — `.default().optional()` is a dead chain because
    // `.default()` already handles the absent-key case; adding `.optional()` after
    // it creates a ZodOptional(ZodDefault) where the outer optional is never reached.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link GastronomyListItemSchema}. */
export type GastronomyListItem = z.infer<typeof GastronomyListItemSchema>;

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Gastronomy summary — essential fields for cards and relation selectors.
 */
export const GastronomySummarySchema = GastronomySchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceRange: true,
    media: true,
    isFeatured: true,
    ownerId: true,
    destinationId: true
}).extend({
    // Use `.default(0)` only — same rationale as GastronomyListItemSchema above.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link GastronomySummarySchema}. */
export type GastronomySummary = z.infer<typeof GastronomySummarySchema>;

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Gastronomy statistics schema.
 * Used for admin dashboards and platform metrics.
 */
export const GastronomyStatsSchema = z.object({
    /** Total number of gastronomy listings. */
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

/** TypeScript type for {@link GastronomyStatsSchema}. */
export type GastronomyStats = z.infer<typeof GastronomyStatsSchema>;
