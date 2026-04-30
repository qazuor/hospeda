import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';

/**
 * PostTag Query Schemas
 *
 * Admin list and filter schemas for the `post_tags` table.
 *
 * Follows the project convention for admin list queries:
 * - Extends `AdminSearchBaseSchema` (page/pageSize/search/sort/includeDeleted/createdAfter/createdBefore).
 * - Adds PostTag-specific filters: `lifecycleState`, `color`, `name` (substring).
 *
 * Public listing uses `PublicPostTagQuerySchema` in `post-tag.public.schema.ts` (D-013).
 *
 * @see AdminSearchBaseSchema in common/admin-search.schema.ts
 * @see D-013, D-018 in SPEC-086 decisions.md
 */

// ============================================================================
// ADMIN SEARCH SCHEMA
// ============================================================================

/**
 * Admin search schema for PostTags.
 *
 * Extends the base admin search with PostTag-specific filters.
 * Uses `page` + `pageSize` pagination (project convention — never `limit`).
 * The `search` field in the base schema performs substring match on `name` (D-014).
 *
 * @example
 * ```ts
 * PostTagAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   search: 'gastr',
 *   lifecycleState: 'ACTIVE',
 *   color: 'ORANGE',
 * });
 * ```
 */
export const PostTagAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by lifecycle state (ACTIVE / INACTIVE / ARCHIVED).
     * `AdminSearchBaseSchema` already has `status` as a loose string; this
     * provides strict enum validation for the PostTag context.
     */
    lifecycleState: LifecycleStatusEnumSchema.optional().describe(
        'Filter by PostTag lifecycle state'
    ),

    /** Filter by display color. */
    color: TagColorEnumSchema.optional().describe('Filter by PostTag color'),

    /**
     * Filter by name substring (case-insensitive).
     * Distinct from the `search` field which is also a name search — kept for
     * explicit URL param compatibility with admin pagination patterns.
     */
    name: z.string().optional().describe('Filter by name substring')
});

/** Inferred TypeScript type for PostTag admin search parameters */
export type PostTagAdminSearch = z.infer<typeof PostTagAdminSearchSchema>;

// Re-export alias matching the project convention used by other entities
export const PostTagQuerySchema = PostTagAdminSearchSchema;
export type PostTagQuery = PostTagAdminSearch;
