/**
 * Public unified search schemas (SPEC-096 / REQ-096-04).
 *
 * These schemas back the GET /api/v1/public/search endpoint that powers the
 * `/busqueda/` page. They define query validation and the shape of the
 * cross-entity response (accommodations, destinations, events, posts).
 *
 * Note: Names are prefixed with `Public` to avoid conflicts with the generic
 * `SearchQuerySchema` / `SearchQuery` exported from `@repo/schemas/api`.
 */
import { z } from 'zod';

// ============================================================================
// QUERY SCHEMA
// ============================================================================

/**
 * Query parameters accepted by the unified public search endpoint
 * (GET /api/v1/public/search).
 *
 * @example
 * ```ts
 * // Valid: q has >= 2 chars, limit within 1-20
 * PublicSearchQuerySchema.parse({ q: 'playa', limit: 5 });
 *
 * // Invalid: q too short => ZodError
 * PublicSearchQuerySchema.parse({ q: 'a' });
 * ```
 */
export const PublicSearchQuerySchema = z.object({
    /**
     * Full-text search query. Must be at least 2 characters long.
     * The API layer is responsible for escaping special characters
     * before forwarding to `safeIlike()`.
     */
    q: z.string().min(2, { message: 'zodError.search.q.min' }).max(100, {
        message: 'zodError.search.q.max'
    }),

    /**
     * Maximum number of items returned **per entity group**.
     * Defaults to 5. Must be between 1 and 20.
     */
    limit: z.coerce.number().int().min(1).max(20).default(5)
});

/** Inferred TypeScript type for {@link PublicSearchQuerySchema}. */
export type PublicSearchQuery = z.infer<typeof PublicSearchQuerySchema>;

// ============================================================================
// RESULT ITEM SCHEMA
// ============================================================================

/**
 * Minimal card-level representation of any searchable entity.
 * The `id` and `slug` fields are always present; all others are optional
 * because different entity types expose different sets of metadata.
 *
 * @example
 * ```ts
 * const item: PublicSearchResultItem = {
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   slug: 'hotel-del-litoral',
 *   name: 'Hotel del Litoral',
 *   type: 'HOTEL',
 * };
 * ```
 */
export const PublicSearchResultItemSchema = z.object({
    /** UUID of the entity. */
    id: z.string().uuid(),

    /**
     * URL-friendly slug for building detail links.
     * Must be at least 1 character.
     */
    slug: z.string().min(1),

    /**
     * Display name.
     * For accommodations and destinations this is the `name` field;
     * for posts it maps to `title`.
     */
    name: z.string().min(1),

    /**
     * URL of the cover / hero image. Optional because not all entities
     * guarantee a cover image at creation time.
     */
    coverImage: z.string().url().optional(),

    /**
     * Entity sub-type discriminator (e.g. `'HOTEL'`, `'HOSTEL'` for
     * accommodations, event categories, etc.). Optional because destinations
     * and posts may not carry a meaningful sub-type.
     */
    type: z.string().optional(),

    /**
     * Top-level classification of the entity.
     * Used by the search results UI to route clicks to the correct detail page.
     * Examples: `'accommodation'`, `'destination'`, `'event'`, `'post'`.
     */
    category: z.string().optional()
});

/** Inferred TypeScript type for {@link PublicSearchResultItemSchema}. */
export type PublicSearchResultItem = z.infer<typeof PublicSearchResultItemSchema>;

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

/**
 * Shape of a single entity-group section in the search response.
 */
const PublicSearchGroupSchema = z.object({
    /** Array of matching items (up to the requested `limit`). */
    items: z.array(PublicSearchResultItemSchema),
    /** Total number of matching records in the database (not just the slice). */
    total: z.number().int().min(0)
});

/**
 * Full response body returned by GET /api/v1/public/search.
 *
 * Each of the four keys corresponds to one searchable entity group.
 * A group is always present even when there are no results (`items: []`,
 * `total: 0`), so consumers can safely destructure without nullability checks.
 *
 * @example
 * ```ts
 * const response: PublicSearchResponse = {
 *   accommodations: { items: [...], total: 12 },
 *   destinations:   { items: [],   total: 0  },
 *   events:         { items: [...], total: 3  },
 *   posts:          { items: [...], total: 7  },
 * };
 * ```
 */
export const PublicSearchResponseSchema = z.object({
    /** Matching accommodations. */
    accommodations: PublicSearchGroupSchema,
    /** Matching destinations. */
    destinations: PublicSearchGroupSchema,
    /** Matching events. */
    events: PublicSearchGroupSchema,
    /** Matching posts / blog articles. */
    posts: PublicSearchGroupSchema
});

/** Inferred TypeScript type for {@link PublicSearchResponseSchema}. */
export type PublicSearchResponse = z.infer<typeof PublicSearchResponseSchema>;
