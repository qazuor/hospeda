/**
 * User Search History — core entity schema (SPEC-289)
 *
 * Defines the storable search-filters subset and the search history entry
 * entity. This is the single source of truth for both the DB model's JSONB
 * type parameter and the API/web layer's type assertions.
 *
 * Design notes:
 *  - Append-only: no soft-delete, no lifecycle, no adminInfo fields.
 *  - `filtersJson` stores the structured search filters (NOT the free-text
 *    query, which lives in the dedicated `queryText` column).
 *  - All filter fields are optional so a partial search can still be recorded.
 *  - Date fields are native `z.date()` (not HTTP-coerced) because this schema
 *    describes the stored/domain representation, not the HTTP wire format.
 */
import { z } from 'zod';
import { UserSearchHistoryIdSchema } from '../../common/id.schema.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';

// ============================================================================
// SEARCH FILTERS SCHEMA (storable subset)
// ============================================================================

/**
 * Storable subset of `AccommodationSearchHttpSchema` that is persisted with
 * each search history entry.
 *
 * Excluded fields (intentionally not stored):
 *  - Viewport bboxes (`bboxNorth`, `bboxSouth`, `bboxEast`, `bboxWest`) —
 *    transient map state, meaningless outside the original UI session.
 *  - Geo coordinates (`latitude`, `longitude`, `radius`) — map-pan state.
 *  - Sorting/pagination (`sortBy`, `sortOrder`, `page`, `pageSize`).
 *  - Include-relation flags (`includeAmenities`, `includeFeatures`).
 *  - Full-text partial-match fields (`name`, `description`, `address`) —
 *    `q` (the free-text intent) is stored separately in `queryText`.
 *
 * @example
 * ```ts
 * const filters: SearchHistoryFilters = {
 *   destinationId: 'uuid-...',
 *   minGuests: 2,
 *   checkIn: new Date('2026-07-15'),
 *   checkOut: new Date('2026-07-20'),
 *   amenities: ['uuid-pool', 'uuid-wifi'],
 * };
 * ```
 */
export const SearchHistoryFiltersSchema = z.object({
    // Location
    /** Destination UUID filter */
    destinationId: z.string().uuid().optional(),

    // Price
    /** Minimum nightly price (in the plan currency) */
    minPrice: z.number().min(0).optional(),
    /** Maximum nightly price */
    maxPrice: z.number().min(0).optional(),
    /** Price currency */
    currency: PriceCurrencyEnumSchema.optional(),

    // Capacity
    /** Minimum guest count */
    minGuests: z.number().int().min(1).optional(),
    /** Maximum guest count */
    maxGuests: z.number().int().min(1).optional(),
    /** Minimum bedroom count */
    minBedrooms: z.number().int().min(0).optional(),
    /** Maximum bedroom count */
    maxBedrooms: z.number().int().min(0).optional(),
    /** Minimum bathroom count */
    minBathrooms: z.number().int().min(0).optional(),
    /** Maximum bathroom count */
    maxBathrooms: z.number().int().min(0).optional(),

    // Rating
    /** Minimum accommodation rating (0–5) */
    minRating: z.number().min(0).max(5).optional(),
    /** Maximum accommodation rating (0–5) */
    maxRating: z.number().min(0).max(5).optional(),

    // Boolean flags
    /** Filter featured accommodations only */
    isFeatured: z.boolean().optional(),
    /** Filter available accommodations only */
    isAvailable: z.boolean().optional(),
    /** Filter accommodations with a pool */
    hasPool: z.boolean().optional(),
    /** Filter accommodations with WiFi */
    hasWifi: z.boolean().optional(),
    /** Filter pet-friendly accommodations */
    allowsPets: z.boolean().optional(),
    /** Filter accommodations with parking */
    hasParking: z.boolean().optional(),

    // Accommodation type
    /** Single accommodation type filter */
    type: AccommodationTypeEnumSchema.optional(),
    /** Multiple accommodation type filter */
    types: z.array(AccommodationTypeEnumSchema).optional(),

    // Amenities and features
    /** Required amenity UUIDs */
    amenities: z.array(z.string().uuid()).optional(),
    /** Required feature UUIDs */
    features: z.array(z.string().uuid()).optional(),

    // Dates
    // NOTE: coerced (not z.date()) because these values round-trip through JSONB:
    // a Date is serialized to an ISO string on write and read back as a string,
    // so the stored representation is a string. z.coerce.date() accepts both the
    // native Date (write path) and the ISO string (read path from DB).
    /** Check-in date */
    checkIn: z.coerce.date().optional(),
    /** Check-out date */
    checkOut: z.coerce.date().optional()
});

/**
 * TypeScript type for {@link SearchHistoryFiltersSchema}.
 * Used as the JSONB `$type<>()` parameter in the DB schema and as the
 * filter payload in service calls.
 */
export type SearchHistoryFilters = z.infer<typeof SearchHistoryFiltersSchema>;

// ============================================================================
// ENTITY SCHEMA
// ============================================================================

/**
 * Core user search history entry schema.
 *
 * Append-only record: no soft-delete, no lifecycle state, no adminInfo.
 * Deletion is always a hard delete (privacy requirement — see SPEC-289 OQ-2).
 *
 * @example
 * ```ts
 * const entry: UserSearchHistoryEntry = {
 *   id: 'uuid-...',
 *   userId: 'uuid-...',
 *   queryText: 'cabaña con pileta',
 *   filtersJson: { minGuests: 4, hasPool: true },
 *   resultCount: 12,
 *   createdAt: new Date(),
 * };
 * ```
 */
export const UserSearchHistoryEntrySchema = z.object({
    /** Entry UUID (primary key) */
    id: UserSearchHistoryIdSchema,
    /** Owner user UUID */
    userId: z
        .string({ message: 'zodError.userSearchHistory.userId.required' })
        .uuid({ message: 'zodError.userSearchHistory.userId.invalidUuid' }),
    /**
     * The free-text query component of the search (the `q` parameter).
     * `null` when the user searched without a text query.
     */
    queryText: z.string().nullable(),
    /**
     * Structured search filters at the time of the search.
     * `null` when the search used no filters beyond the text query.
     */
    filtersJson: SearchHistoryFiltersSchema.nullable(),
    /**
     * Number of results returned by the search at record time.
     * `null` when the result count was not available (e.g. fire-and-forget error).
     */
    resultCount: z.number().int().nullable(),
    /** Timestamp when the search was performed (UTC) */
    createdAt: z.date()
});

/**
 * TypeScript type for {@link UserSearchHistoryEntrySchema}.
 * Inferred from the schema — do not define separately.
 */
export type UserSearchHistoryEntry = z.infer<typeof UserSearchHistoryEntrySchema>;
