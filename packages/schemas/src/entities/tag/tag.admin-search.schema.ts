import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { TagColorEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for tags.
 * Extends base admin search with tag-specific filters.
 *
 * Note: The `color` column uses `TagColorPgEnum` (enum values like RED, BLUE, etc.),
 * not hex color strings.
 *
 * @example
 * ```ts
 * const params = TagAdminSearchSchema.parse({
 *   page: 1,
 *   color: 'RED',
 *   search: 'beach'
 * });
 * ```
 */
export const TagAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by tag color (enum value, e.g. RED, BLUE, GREEN) */
    color: TagColorEnumSchema.optional().describe('Filter by tag color')
});

/** Inferred TypeScript type for tag admin search parameters */
export type TagAdminSearch = z.infer<typeof TagAdminSearchSchema>;
