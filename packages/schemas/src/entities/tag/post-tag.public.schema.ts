import { z } from 'zod';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';
import { PostTagSchema } from './post-tag.schema.js';

/**
 * PostTag Public Schemas
 *
 * Response and query schemas for the public PostTag endpoint:
 * `GET /api/v1/public/posts/tags` (D-013, SPEC-086).
 *
 * Design:
 * - No pagination — realistic volume is 50–200 tags total (D-013).
 * - `Cache-Control: public, max-age=600` (10 minutes) set at route level.
 * - Only `ACTIVE` PostTags are returned.
 * - `withCounts=true` adds `usageCount: number` per tag (count of posts using it).
 * - Only a safe subset of fields is returned (no audit fields, no deletedAt).
 *
 * @see D-013 in SPEC-086 decisions.md
 */

// ============================================================================
// QUERY SCHEMA
// ============================================================================

/**
 * Query params for `GET /api/v1/public/posts/tags`.
 *
 * @example
 * ```ts
 * PublicPostTagQuerySchema.parse({}) // => { withCounts: false }
 * PublicPostTagQuerySchema.parse({ withCounts: 'true' }) // => { withCounts: true }
 * PublicPostTagQuerySchema.parse({ withCounts: true })   // => { withCounts: true }
 * ```
 */
export const PublicPostTagQuerySchema = z.object({
    /**
     * When `true`, each PostTag in the response includes `usageCount` — the
     * number of published posts that reference this tag.
     *
     * Coerced from query string (`'true'`/`'false'`/`'1'`/`'0'`).
     * Defaults to `false`.
     */
    withCounts: queryBooleanParam().default(false)
});

export type PublicPostTagQuery = z.infer<typeof PublicPostTagQuerySchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Public representation of a PostTag — a safe subset without audit fields.
 *
 * Exposed to anonymous visitors and search engines. Contains only what is
 * necessary to render tag badges and public filter links.
 *
 * @example
 * ```ts
 * // Response item without counts
 * {
 *   id: '550e8400-...',
 *   name: 'Gastronomía',
 *   slug: 'gastronomia',
 *   color: 'ORANGE',
 *   icon: null,
 *   lifecycleState: 'ACTIVE',
 *   description: null,
 * }
 * ```
 */
export const PublicPostTagSchema = PostTagSchema.pick({
    id: true,
    name: true,
    slug: true,
    color: true,
    icon: true,
    lifecycleState: true,
    description: true
});

export type PublicPostTag = z.infer<typeof PublicPostTagSchema>;

/**
 * Public PostTag item enriched with `usageCount`.
 *
 * Returned when the caller requests `?withCounts=true` (D-013).
 * `usageCount` is the count of posts that reference this PostTag.
 */
export const PublicPostTagWithCountSchema = PublicPostTagSchema.extend({
    /** Number of posts that reference this PostTag. Always a non-negative integer. */
    usageCount: z.number().int().nonnegative()
});

export type PublicPostTagWithCount = z.infer<typeof PublicPostTagWithCountSchema>;

// ============================================================================
// LIST RESPONSE SCHEMAS
// ============================================================================

/**
 * Response body for `GET /api/v1/public/posts/tags` (without counts).
 *
 * No pagination — the full list is returned in a single response (D-013).
 */
export const PublicPostTagListResponseSchema = z.object({
    /**
     * All ACTIVE PostTags. Order is implementation-defined (typically
     * alphabetical by name at the service layer).
     */
    data: z.array(PublicPostTagSchema)
});

export type PublicPostTagListResponse = z.infer<typeof PublicPostTagListResponseSchema>;

/**
 * Response body for `GET /api/v1/public/posts/tags?withCounts=true`.
 *
 * Each item includes `usageCount` for the post count display on the public
 * tag listing or sidebar.
 */
export const PublicPostTagListWithCountsResponseSchema = z.object({
    /**
     * All ACTIVE PostTags with usage counts.
     */
    data: z.array(PublicPostTagWithCountSchema)
});

export type PublicPostTagListWithCountsResponse = z.infer<
    typeof PublicPostTagListWithCountsResponseSchema
>;

// ============================================================================
// DISCRIMINATED RESPONSE UNION
// ============================================================================

/**
 * Union of the two possible response shapes for the public PostTag list.
 *
 * Use this when routing code needs to handle both `withCounts=false`
 * and `withCounts=true` responses generically.
 *
 * @example
 * ```ts
 * if (query.withCounts) {
 *   // data items have `usageCount`
 * } else {
 *   // data items do not have `usageCount`
 * }
 * ```
 */
export const PublicPostTagResponseSchema = z.discriminatedUnion('withCounts', [
    z.object({ withCounts: z.literal(false), data: z.array(PublicPostTagSchema) }),
    z.object({ withCounts: z.literal(true), data: z.array(PublicPostTagWithCountSchema) })
]);

export type PublicPostTagResponse = z.infer<typeof PublicPostTagResponseSchema>;

// ============================================================================
// RE-EXPORTED FOR CONVENIENCE
// ============================================================================

// Explicit re-exports of constituent schemas for consumers who only need parts
export { LifecycleStatusEnumSchema, TagColorEnumSchema };
