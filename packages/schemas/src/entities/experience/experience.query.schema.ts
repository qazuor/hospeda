import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { ExperienceTypeEnumSchema } from '../../enums/index.js';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience Query Schemas
 *
 * This file contains all schemas related to querying experience listings:
 * - Filters schema
 * - Search / list schema
 * - Summary schema
 * - Stats schema
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Experience-specific filter schema.
 * Used as a building block for search schemas.
 */
export const ExperienceFiltersSchema = z.object({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by experience sub-type. */
    type: ExperienceTypeEnumSchema.optional(),
    /** Filter listings that have a given amenity. Accepts a list of amenity UUIDs. */
    amenities: z.array(z.string().uuid()).optional(),
    /** Filter listings that have a given feature. Accepts a list of feature UUIDs. */
    features: z.array(z.string().uuid()).optional(),
    /** Filter by featured status. */
    isFeatured: z.boolean().optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Filter by active subscription flag (public listing visibility gate). */
    hasActiveSubscription: z.boolean().optional(),
    /** Minimum average rating (0–5). */
    minRating: z.number().min(0).max(5).optional(),
    /** Maximum average rating (0–5). */
    maxRating: z.number().min(0).max(5).optional(),
    /** Created after this date. */
    createdAfter: z.date().optional(),
    /** Created before this date. */
    createdBefore: z.date().optional()
});

/** TypeScript type for {@link ExperienceFiltersSchema}. */
export type ExperienceFilters = z.infer<typeof ExperienceFiltersSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard experience search schema.
 * Extends the platform base search with experience-specific filters.
 *
 * @example
 * ```ts
 * const results = ExperienceSearchSchema.parse({
 *   q: 'kayak',
 *   type: 'KAYAK_RENTAL',
 *   page: 1,
 *   pageSize: 20,
 * });
 * ```
 */
export const ExperienceSearchSchema = BaseSearchSchema.extend({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by experience sub-type. */
    type: ExperienceTypeEnumSchema.optional(),
    /** Filter listings that have all these amenity UUIDs. */
    amenities: z.array(z.string().uuid()).optional(),
    /** Filter listings that have all these feature UUIDs. */
    features: z.array(z.string().uuid()).optional(),
    /** Filter by featured status. */
    isFeatured: z.boolean().optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Filter by active subscription flag. */
    hasActiveSubscription: z.boolean().optional(),
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

/** TypeScript type for {@link ExperienceSearchSchema}. */
export type ExperienceSearch = z.infer<typeof ExperienceSearchSchema>;
/** Alias for {@link ExperienceSearch}. */
export type ExperienceSearchInput = ExperienceSearch;

/**
 * Standard experience search result schema.
 * Wraps an array of full experience schemas with pagination metadata.
 */
export const ExperienceSearchResultSchema = PaginationResultSchema(ExperienceSchema);

/** TypeScript type for {@link ExperienceSearchResultSchema}. */
export type ExperienceSearchResult = z.infer<typeof ExperienceSearchResultSchema>;

// ============================================================================
// LIST ITEM SCHEMA
// ============================================================================

/**
 * Experience list item — public-safe minimal projection for listing pages.
 * Includes the experience-specific fields needed for listing cards (AC-1.3).
 */
export const ExperienceListItemSchema = ExperienceSchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true,
    hasActiveSubscription: true,
    media: true,
    isFeatured: true,
    ownerId: true,
    destinationId: true,
    createdAt: true,
    updatedAt: true
}).extend({
    // Use `.default(0)` only — `.default().optional()` is a dead chain because
    // `.default()` already handles the absent-key case.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link ExperienceListItemSchema}. */
export type ExperienceListItem = z.infer<typeof ExperienceListItemSchema>;

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Experience summary — essential fields for cards and relation selectors.
 */
export const ExperienceSummarySchema = ExperienceSchema.pick({
    id: true,
    name: true,
    slug: true,
    summary: true,
    type: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true,
    hasActiveSubscription: true,
    media: true,
    isFeatured: true,
    ownerId: true,
    destinationId: true
}).extend({
    // Use `.default(0)` only — same rationale as ExperienceListItemSchema above.
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/** TypeScript type for {@link ExperienceSummarySchema}. */
export type ExperienceSummary = z.infer<typeof ExperienceSummarySchema>;

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Experience statistics schema.
 * Used for admin dashboards and platform metrics.
 */
export const ExperienceStatsSchema = z.object({
    /** Total number of experience listings. */
    total: z.number(),
    /** Number of featured listings. */
    totalFeatured: z.number(),
    /** Number of listings with an active subscription. */
    totalActiveSubscription: z.number(),
    /** Average rating across all listings (optional, absent when no reviews exist). */
    averageRating: z.number().min(0).max(5).optional(),
    /** Count breakdown by sub-type. */
    totalByType: z.record(z.string(), z.number()),
    /** Count breakdown by price unit. */
    totalByPriceUnit: z.record(z.string(), z.number())
});

/** TypeScript type for {@link ExperienceStatsSchema}. */
export type ExperienceStats = z.infer<typeof ExperienceStatsSchema>;
